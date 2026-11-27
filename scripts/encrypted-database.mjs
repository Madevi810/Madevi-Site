import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { appendFile, link, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { backupSettings, databaseUrl } from "../src/lib/env.ts";
import { backupDirectory, backupName, openBackup } from "../src/lib/backup-artifact.ts";

const magic=Buffer.from("MADEVIB1");
const headerLength=magic.length+12;
const tagLength=16;
export const operationLock=7412311;

const useFile=(filename)=>createWriteStream(filename,{flags:"wx",mode:0o600});

export class OperationError extends Error {}
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
async function decrypt(directory,name,key,output) {
  const {handle,size}=await openBackup(directory,name).catch(()=>abort("Berkas backup tidak valid atau belum tersedia."));
  const header=Buffer.alloc(headerLength),tag=Buffer.alloc(tagLength),end=size-tagLength;
  try {
    const first=await handle.read(header,0,headerLength,0);
    const last=await handle.read(tag,0,tagLength,end);
    if(first.bytesRead!==headerLength||last.bytesRead!==tagLength||!header.subarray(0,magic.length).equals(magic))abort("Format backup tidak dikenali.");
    const decipher=createDecipheriv("aes-256-gcm",key,header.subarray(magic.length));
    decipher.setAAD(header);decipher.setAuthTag(tag);
    const stream=handle.createReadStream({start:headerLength,end:end-1});
    try {await pipeline(stream,decipher,output?useFile(output):new Writable({write(_chunk,_encoding,done){done();}}));}
    catch {abort("Integritas backup tidak dapat diverifikasi. Periksa berkas dan kunci.");}
  } finally {await handle.close();}
  return size;
}

export async function backupConfiguration() {
  let settings;
  try {settings=backupSettings();}catch(error){abort(error.message);}
  if(!settings)abort("Siapkan MADEVI_BACKUP_KEY dan direktori absolut MADEVI_BACKUP_DIR.");
  const checkout=await realpath(fileURLToPath(new URL("../",import.meta.url)));
  const directory=resolve(settings.directory);
  if(settings.directory!==directory)abort("Direktori backup harus berupa jalur absolut langsung.");
  const fromCheckout=relative(checkout,directory);
  if(!fromCheckout || (!fromCheckout.startsWith("../") && fromCheckout!==".."))abort("Direktori backup harus di luar checkout Madevi.");
  await mkdir(directory,{recursive:true,mode:0o700});
  await backupDirectory(directory);
  return {directory,key:Buffer.from(settings.key,"hex")};
}

export function targetConfiguration() {
  if(!process.env.MADEVI_RESTORE_DATABASE_URL)abort("Isi MADEVI_RESTORE_DATABASE_URL dengan koneksi target baru.");
  const url=databaseUrl({...process.env,DATABASE_URL:process.env.MADEVI_RESTORE_DATABASE_URL});
  const env=pgEnv(url), source=pgEnv(databaseUrl());
  if(!/^madevi_restore_[a-z0-9_]{1,30}$/.test(env.PGDATABASE)||env.PGDATABASE===source.PGDATABASE)abort("Target harus database baru dengan nama madevi_restore_* yang berbeda dari sumber.");
  return {url,env,identity:`${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`};
}

async function withEmptyTarget(confirmation,run) {
  const config=targetConfiguration();
  if(confirmation!==`RESTORE:${config.identity}`)abort("Konfirmasi target tidak sesuai dengan konfigurasi host.");
  const pool=createDatabasePool(config.url,1);
  let target;
  try {
    target=await pool.connect();
    const ready=await target.query("SELECT current_database() AS name,pg_try_advisory_lock($1) AS locked",[operationLock]);
    if(ready.rows[0].name!==config.env.PGDATABASE||!ready.rows[0].locked)abort("Target tidak cocok atau sedang dipakai.");
    const objects=await target.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'
      UNION ALL SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      UNION ALL SELECT extname FROM pg_extension WHERE extname<>'plpgsql'
      UNION ALL SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      UNION ALL SELECT oid::text FROM pg_type WHERE typnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
      LIMIT 1`);
    if(objects.rowCount)abort("Database target harus kosong.");
    const concurrent=await target.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend' LIMIT 1");
    if(concurrent.rowCount)abort("Database target masih dipakai koneksi lain.");
    return await run(target,config.env);
  } finally {target?.release();await pool.end();}
}

export async function runEncryptedOperation({operation,id=randomUUID(),artifact,confirmation,progress=async()=>{}}) {
  if(operation==="target_check") {
    await withEmptyTarget(confirmation,async()=>{});
    return {details:"Target terpisah dapat diakses dan masih kosong."};
  }
  const {directory,key}=await backupConfiguration();
  if(operation!=="backup"&&!backupName.test(artifact??""))abort("Gunakan nama berkas backup Madevi dari daftar pekerjaan.");
  if(operation==="verify") {
    await progress("verifying");
    return {artifact,bytes:await decrypt(directory,artifact,key),details:"Tag autentikasi backup cocok."};
  }
  if(operation==="backup") {
    const live=databaseUrl();
    const source=databaseUrl({...process.env,DATABASE_URL:process.env.MADEVI_BACKUP_DATABASE_URL||live});
    const sourceEnv=pgEnv(source),liveEnv=pgEnv(live);
    if(["PGHOST","PGPORT","PGDATABASE"].some(field=>sourceEnv[field]!==liveEnv[field]))abort("Role backup harus menunjuk endpoint dan database aplikasi yang sama.");
    const name=`madevi-${new Date().toISOString().replace(/[:.]/g,"-").toLowerCase()}-${id}.dump.gcm`;
    const staging=`madevi-stage-${id}.dump.gcm`;
    await progress("dumping");
    const job=processJob("pg_dump",["--no-password","--format=custom","--no-owner","--no-acl","--lock-wait-timeout=5s"],sourceEnv);
    try {
      await encrypt(job.child.stdout,join(directory,staging),key);
      await job.done;
      await progress("verifying");
      const bytes=await decrypt(directory,staging,key);
      await link(join(directory,staging),join(directory,name));
      return {artifact:name,bytes,details:"Integritas AES-GCM terverifikasi"};
    } finally {job.child.kill();await job.done.catch(()=>{});await rm(join(directory,staging),{force:true});}
  }
  if(operation!=="restore")abort("Jenis operasi database tidak dikenal.");
  await progress("checking_target");
  return withEmptyTarget(confirmation,async(target,env)=>{
    const plaintext=await mkdtemp(join(tmpdir(),"madevi-restore-"));
    try {
      const dump=join(plaintext,"backup.dump");
      await progress("verifying");
      const bytes=await decrypt(directory,artifact,key,dump);
      await progress("restoring");
      const job=processJob("pg_restore",["--no-password","--dbname",env.PGDATABASE,"--single-transaction","--no-owner","--no-acl",dump],env);
      job.child.stdout.resume();await job.done;
      await target.query("SELECT version,checksum FROM madevi_schema_migrations LIMIT 1");
      await target.query("BEGIN");
      try {
        const support=(await target.query(`SELECT to_regclass('madevi_operations') IS NOT NULL AS operations,
          to_regclass('madevi_operations_health') IS NOT NULL AS queue, to_regclass('madevi_message_jobs') IS NOT NULL AS messages`)).rows[0];
        if(support.operations) {
          await target.query(`UPDATE madevi_operations SET status='failed',finished_at=now(),details='Pekerjaan berasal dari snapshot dan perlu diajukan ulang.'
            WHERE status IN ('queued','running')`);
        }
        if(support.queue)await target.query("DELETE FROM madevi_operations_health");
        if(support.messages)await target.query("UPDATE madevi_message_jobs SET status='cancelled',updated_at=now() WHERE status='scheduled'");
        await target.query("COMMIT");
      } catch(error){await target.query("ROLLBACK").catch(()=>{});throw error;}
      return {artifact,bytes,details:"Restore ke database terpisah dan tabel migrasi terbaca. Antrean lama ditutup pada target."};
    } finally {await rm(plaintext,{recursive:true,force:true});}
  });
}

async function cli() {
  const [operation,artifact,confirmation]=process.argv.slice(2);
  let pool,client;
  const id=randomUUID();
  let recorded=false;
  try {
    if(!["backup","restore","verify"].includes(operation))abort("Gunakan operasi backup, verify atau restore.");
    if(operation!=="verify") {
      pool=createDatabasePool();client=await pool.connect();
      if(!(await client.query("SELECT pg_try_advisory_lock($1) AS locked",[operationLock])).rows[0].locked)abort("Ada pekerjaan operasional berjalan.");
      if(operation==="restore"&&confirmation!==`RESTORE:${targetConfiguration().identity}`)abort("Konfirmasi target tidak sesuai dengan konfigurasi host.");
      await client.query("INSERT INTO madevi_operations(id,kind,status,artifact,started_at) VALUES($1,$2,'running',$3,now())",[id,operation,artifact??null]);
      recorded=true;
    }
    const result=await runEncryptedOperation({operation,id,artifact,confirmation});
    if(recorded)await client.query("UPDATE madevi_operations SET status='completed',artifact=$2,bytes=$3,details=$4,finished_at=now() WHERE id=$1",[id,result.artifact,result.bytes,result.details]);
    console.log(result.artifact?`${result.details} Berkas ${result.artifact}, ${result.bytes} byte.`:result.details);
  } catch(error) {
    const details=error instanceof OperationError?error.message:"Operasi basis data gagal. Periksa konfigurasi, izin dan koneksi.";
    if(recorded)await client.query("UPDATE madevi_operations SET status='failed',details=$2,finished_at=now() WHERE id=$1",[id,details]).catch(()=>{});
    console.error(details);process.exitCode=1;
  } finally {client?.release();await pool?.end();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await cli();
