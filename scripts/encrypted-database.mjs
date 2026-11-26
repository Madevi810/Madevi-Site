import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, lstat, link, mkdir, mkdtemp, open, realpath, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { backupSettings, databaseUrl } from "../src/lib/env.ts";

const magic=Buffer.from("MADEVIB1");
const headerLength=magic.length+12;
const tagLength=16;
const lock=7412311;
const [operation, input, confirmation]=process.argv.slice(2);
const acceptable=/^madevi-[a-z0-9-]{1,100}\.dump\.gcm$/;
const useFile=(filename)=>createWriteStream(filename,{flags:"wx",mode:0o600});

class OperationError extends Error {}
const abort=message=>{throw new OperationError(message);};

function pgEnv(connection) {
  const url=new URL(connection);
  if(!["postgres:","postgresql:"].includes(url.protocol)||!url.hostname||!url.username||url.hash||!url.pathname.slice(1)||
      [...url.searchParams.keys()].some(key=>!["sslmode","sslrootcert","sslcert","sslkey"].includes(key))) {
    abort("Gunakan URI PostgreSQL langsung dengan opsi TLS libpq yang didukung.");
  }
  return {
    PATH:process.env.PATH, LANG:"C", PGHOST:url.hostname.replace(/^\[(.*)\]$/,"$1"),
    PGPORT:url.port||"5432", PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
    PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password),
    PGSSLMODE:url.searchParams.get("sslmode")||"prefer",
    PGSSLROOTCERT:url.searchParams.get("sslrootcert")??undefined,
    PGSSLCERT:url.searchParams.get("sslcert")??undefined,
    PGSSLKEY:url.searchParams.get("sslkey")??undefined, PGCONNECT_TIMEOUT:"5"
  };
}
function processJob(tool,args,env) {
  const child=spawn(tool,args,{env,stdio:["ignore","pipe","ignore"]});
  const timeout=setTimeout(()=>child.kill("SIGKILL"),15*60*1000);
  const done=new Promise((resolve,reject)=>{
    child.once("error",()=>reject(new OperationError(`Periksa pemasangan ${tool} pada host.`)));
    child.once("close",code=>code===0?resolve():reject(new OperationError(`${tool} gagal. Periksa koneksi, versi klien, izin, kapasitas, dan disk.`)));
  }).finally(()=>clearTimeout(timeout));
  done.catch(()=>{});
  return {child,done};
}
async function encrypt(source,filename,key) {
  const header=Buffer.concat([magic,randomBytes(12)]);
  const cipher=createCipheriv("aes-256-gcm",key,header.subarray(magic.length));
  cipher.setAAD(header);
  await writeFile(filename,header,{flag:"wx",mode:0o600});
  await pipeline(source,cipher,createWriteStream(filename,{flags:"a"}));
  await appendFile(filename,cipher.getAuthTag());
  const output=await open(filename,"r+");
  try {await output.sync();} finally {await output.close();}
}
async function decrypt(filename,key,output) {
  const metadata=await lstat(filename);
  if(!metadata.isFile()||metadata.size<=headerLength+tagLength)abort("Berkas backup tidak valid.");
  const fd=await open(filename,"r");
  const header=Buffer.alloc(headerLength),tag=Buffer.alloc(tagLength),end=metadata.size-tagLength;
  try {
    const first=await fd.read(header,0,headerLength,0);
    const last=await fd.read(tag,0,tagLength,end);
    if(first.bytesRead!==headerLength||last.bytesRead!==tagLength||!header.subarray(0,magic.length).equals(magic))abort("Format backup tidak dikenali.");
  } finally {await fd.close();}
  const decipher=createDecipheriv("aes-256-gcm",key,header.subarray(magic.length));
  decipher.setAAD(header);decipher.setAuthTag(tag);
  try {await pipeline(createReadStream(filename,{start:headerLength,end:end-1}),decipher,output?useFile(output):new Writable({write(_chunk,_encoding,done){done();}}));}
  catch {abort("Integritas backup tidak dapat diverifikasi. Periksa berkas dan kunci.");}
}

let controlPool, control, targetPool, target, id, plaintext, inProgress=false, failure;
try {
  let settings;
  try {settings=backupSettings();}catch(error){abort(error.message);}
  if(!settings)abort("Siapkan MADEVI_BACKUP_KEY dan direktori absolut MADEVI_BACKUP_DIR.");
  const {directory,key: keyHex}=settings;
  const checkout=await realpath(fileURLToPath(new URL("../",import.meta.url)));
  function ensureSeparate(path) {
    const fromCheckout=relative(checkout,path);
    if(!fromCheckout || (!fromCheckout.startsWith("../") && fromCheckout!==".."))abort("Direktori backup harus di luar checkout Madevi.");
  }
  ensureSeparate(resolve(directory));
  if(!["backup","restore","verify"].includes(operation))abort("Gunakan salah satu perintah backup, verify, atau restore.");
  if(operation!=="backup"&&!acceptable.test(input??""))abort("Gunakan nama berkas backup Madevi dari daftar pekerjaan.");
  const key=Buffer.from(keyHex,"hex");
  await mkdir(directory,{recursive:true,mode:0o700});
  ensureSeparate(await realpath(directory));
  const dirInfo=await lstat(directory);
  if(!dirInfo.isDirectory()||(dirInfo.mode&0o077)!==0)abort("Direktori backup harus privat (mode 0700).");
  if(operation==="verify") {
    await decrypt(join(directory,input),key);
    console.log("Tag autentikasi backup cocok. Restore terisolasi diperlukan untuk membuktikan isi dapat dipulihkan.");
  } else {
    const live=databaseUrl();
    const source=databaseUrl({...process.env,DATABASE_URL:process.env.MADEVI_BACKUP_DATABASE_URL||live});
    const sourceEnv=pgEnv(source), liveEnv=pgEnv(live);
    if(["PGHOST","PGPORT","PGDATABASE"].some(field=>sourceEnv[field]!==liveEnv[field]))abort("Role backup harus menunjuk endpoint dan database aplikasi yang sama.");
    controlPool=createDatabasePool(live,1);
    control=await controlPool.connect();
    const claimed=await control.query("SELECT pg_try_advisory_lock($1) AS locked",[lock]);
    if(!claimed.rows[0].locked)abort("Ada pekerjaan backup atau restore yang sedang berjalan.");
    const verified=await control.query("SELECT current_database() AS name");
    if(verified.rows[0].name!==sourceEnv.PGDATABASE)abort("Identitas database sumber tidak cocok.");
    const name=operation==="backup"?`madevi-${new Date().toISOString().replace(/[:.]/g,"-").toLowerCase()}-${randomBytes(4).toString("hex")}.dump.gcm`:input;
    const filename=join(directory,name);
    if(operation==="restore") {
      if(!process.env.MADEVI_RESTORE_DATABASE_URL)abort("Isi MADEVI_RESTORE_DATABASE_URL dengan koneksi target baru.");
      const url=databaseUrl({...process.env,DATABASE_URL:process.env.MADEVI_RESTORE_DATABASE_URL});
      const env=pgEnv(url);
      if(!/^madevi_restore_[a-z0-9_]{1,30}$/.test(env.PGDATABASE)||env.PGDATABASE===sourceEnv.PGDATABASE)abort("Target harus database baru dengan nama madevi_restore_* yang berbeda dari sumber.");
      if(confirmation!==`RESTORE:${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`)abort("Ulangi perintah dengan konfirmasi RESTORE:host:port/nama_database.");
      targetPool=createDatabasePool(url,1);target=await targetPool.connect();
      const ready=await target.query("SELECT current_database() AS name,pg_try_advisory_lock($1) AS locked",[lock]);
      if(ready.rows[0].name!==env.PGDATABASE||!ready.rows[0].locked)abort("Target tidak cocok atau sedang dipakai.");
      const objects=await target.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'
        UNION ALL SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
        UNION ALL SELECT extname FROM pg_extension WHERE extname<>'plpgsql'
        UNION ALL SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LIMIT 1`);
      if(objects.rowCount)abort("Database target harus kosong.");
    }
    id=randomUUID();
    await control.query(`UPDATE madevi_operations SET status='failed',finished_at=now(),details='Terhenti sebelum selesai' WHERE status='running'`);
    await control.query("INSERT INTO madevi_operations(id,kind,status,artifact) VALUES($1,$2,'running',$3)",[id,operation,name]);
    inProgress=true;
    if(operation==="backup") {
      const staging=join(directory,`.${id}.part`);
      const job=processJob("pg_dump",["--no-password","--format=custom","--no-owner","--no-acl","--lock-wait-timeout=5s"],sourceEnv);
      try {
        await encrypt(job.child.stdout,staging,key);
        await job.done;
        await decrypt(staging,key);
        await link(staging,filename);
      } finally {job.child.kill();await job.done.catch(()=>{});await rm(staging,{force:true});}
    } else {
      plaintext=await mkdtemp(join(tmpdir(),"madevi-restore-"));
      const dump=join(plaintext,"backup.dump");
      await decrypt(filename,key,dump);
      const env=pgEnv(process.env.MADEVI_RESTORE_DATABASE_URL);
      const job=processJob("pg_restore",["--no-password","--dbname",env.PGDATABASE,"--single-transaction","--no-owner","--no-acl",dump],env);
      job.child.stdout.resume();
      await job.done;
      await target.query("SELECT version,checksum FROM madevi_schema_migrations LIMIT 1");
    }
    const size=(await stat(filename)).size;
    await control.query("UPDATE madevi_operations SET status='completed',bytes=$2,finished_at=now(),details=$3 WHERE id=$1",
      [id,size,operation==="backup"?"Integritas AES-GCM terverifikasi":"Restore ke database terpisah dan tabel migrasi terbaca"]);
    console.log(`Operasi ${operation} selesai. Berkas ${name}, ${size} byte.`);
  }
} catch(error) {
  failure=error instanceof OperationError?error.message:"Operasi basis data gagal. Periksa konfigurasi, izin, dan koneksi.";
  if(inProgress)await control?.query("UPDATE madevi_operations SET status='failed',finished_at=now(),details=$2 WHERE id=$1",[id,failure]).catch(()=>{});
  console.error(failure);process.exitCode=1;
} finally {
  if(plaintext)await rm(plaintext,{recursive:true,force:true});
  target?.release();await targetPool?.end();control?.release();await controlPool?.end();
}
