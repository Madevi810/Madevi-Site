import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import { OperationError } from "./encrypted-database.mjs";

const execute=promisify(execFile);
const alias=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const image=z.string().regex(/^sha256:[0-9a-f]{64}$/);
const release=z.object({id:alias,image,migrations:z.array(z.string().regex(/^\d{3}_[a-z0-9_]+$/)).min(1).max(50)}).strict();
const settings=z.object({id:alias,cpus:z.number().min(0.25).max(32),memoryMiB:z.number().int().min(384).max(65536)}).strict();
const active=z.object({release,configuration:settings}).strict();
const catalogSchema=z.object({
  directory:z.string().refine(isAbsolute), project:alias,
  releases:z.array(release).min(1).max(20), configurations:z.array(settings).min(1).max(20)
}).strict().refine(input=>[input.releases,input.configurations].every(entries=>new Set(entries.map(item=>item.id)).size===entries.length));

const digest=entry=>createHash("sha256").update(JSON.stringify(entry)).digest("hex");
const fail=message=>{throw new OperationError(message);};

async function privateJson(filename,max=65536) {
  const metadata=await lstat(filename);
  if(await realpath(filename)!==resolve(filename)||!metadata.isFile()||metadata.size>max||(metadata.mode&0o077)!==0)fail("Berkas katalog atau profil host harus privat.");
  return JSON.parse(await readFile(filename,"utf8"));
}

async function writeProfile(filename,contents) {
  const temporary=filename+"."+randomUUID();
  try {
    await writeFile(temporary,JSON.stringify(contents),{mode:0o600,flag:"wx"});
    await rename(temporary,filename);
  } finally {await rm(temporary,{force:true});}
}

async function readCatalog() {
  const path=process.env.MADEVI_HOST_CATALOG;
  if(!path)return null;
  if(!isAbsolute(path))fail("Jalur katalog host harus absolut.");
  const catalog=catalogSchema.parse(await privateJson(path));
  const directory=resolve(catalog.directory);
  const dirInfo=await lstat(directory);
  if(await realpath(directory)!==directory||!dirInfo.isDirectory()||(dirInfo.mode&0o077)!==0)fail("Direktori operasi host harus privat.");
  return {catalog,statePath:join(directory,"active.json"),overridePath:join(directory,"compose.override.json")};
}

export async function hostProfile() {
  const input=await readCatalog();
  if(!input)return null;
  const {catalog,statePath}=input;
  const state=active.parse(await privateJson(statePath));
  const currentRelease=catalog.releases.find(item=>item.id===state.release.id);
  const currentConfiguration=catalog.configurations.find(item=>item.id===state.configuration.id);
  if(!currentRelease||!currentConfiguration||digest(state.release)!==digest(currentRelease)||digest(state.configuration)!==digest(currentConfiguration)) {
    fail("Profil aktif tidak cocok dengan katalog host.");
  }
  return {...input,state};
}

export function hostChoices(host) {
  if(!host)return null;
  return {
    active:{release:host.state.release.id,configuration:host.state.configuration.id},
    releases:host.catalog.releases.map(item=>({id:item.id,revision:digest(item),migrations:item.migrations})),
    configurations:host.catalog.configurations.map(item=>({id:item.id,revision:digest(item),cpus:item.cpus,memoryMiB:item.memoryMiB}))
  };
}

async function docker(args) {
  const env={...process.env};
  delete env.DOCKER_CONTEXT;
  return execute("docker",["--host","unix:///var/run/docker.sock",...args],{env,timeout:90000,maxBuffer:128000});
}

function overrideFor(next) {
  return {services:{madevi:{image:next.release.image,cpus:next.configuration.cpus,mem_limit:`${next.configuration.memoryMiB}m`}}};
}

async function prepareCurrent(releaseId,configurationId) {
  const input=await readCatalog();
  if(!input)fail("Isi MADEVI_HOST_CATALOG terlebih dahulu.");
  const release=input.catalog.releases.find(item=>item.id===releaseId);
  const configuration=input.catalog.configurations.find(item=>item.id===configurationId);
  if(!release||!configuration)fail("Pilih ID rilis dan profil dari katalog host.");
  const initial={release,configuration};
  let created=false;
  try {
    await writeFile(input.overridePath,JSON.stringify(overrideFor(initial)),{mode:0o600,flag:"wx"});
    created=true;
    await writeFile(input.statePath,JSON.stringify(initial),{mode:0o600,flag:"wx"});
  } catch(error) {
    if(created)await rm(input.overridePath,{force:true});
    throw error;
  }
}

async function activate(host,next) {
  const args=["compose","--project-name",host.catalog.project,
    "-f",fileURLToPath(new URL("../compose.yml",import.meta.url))];
  const downloads=fileURLToPath(new URL("../compose.download.yml",import.meta.url));
  const mount=await lstat(downloads).catch(error=>{if(error.code!=="ENOENT")throw error;return null;});
  if(mount) {
    if(!mount.isFile()||await realpath(downloads)!==downloads)fail("Override unduhan harus berkas Compose lokal.");
    args.push("-f",downloads);
  }
  args.push("-f",host.overridePath);
  await docker(["image","inspect",next.release.image]);
  await writeProfile(host.overridePath,overrideFor(next));
  await docker([...args,"up","-d","--no-build","--pull","never","--no-deps","--force-recreate","madevi"]);
  const container=(await docker([...args,"ps","-q","madevi"])).stdout.trim();
  if(!/^[0-9a-f]{12,64}$/.test(container))fail("Container Madevi tidak ditemukan setelah perpindahan.");
  if((await docker(["inspect","--format","{{.Image}}",container])).stdout.trim()!==next.release.image)fail("Image aktif berbeda dari katalog.");
  for(let attempt=0;attempt<12;attempt++) {
    try {
      const result=await Promise.all(["live","ready"].map(path=>fetch(`http://127.0.0.1:3000/api/health/${path}`,{redirect:"error",signal:AbortSignal.timeout(2500)})));
      if(result.every(response=>response.ok)) {
        await writeProfile(host.statePath,next);
        return;
      }
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,2500));
  }
  fail("Probe live dan ready belum lulus.");
}

export async function runHostRollback({host,kind,artifact,target,revision,client,progress,activateProfile=activate}) {
  if(!host)fail("Katalog atau profil aktif host belum tersedia.");
  const isRelease=kind==="release";
  const entry=(isRelease?host.catalog.releases:host.catalog.configurations).find(item=>item.id===target);
  if(!entry||digest(entry)!==revision)fail("Pilihan host berubah. Periksa katalog dan ajukan kembali.");
  const next=isRelease?{...host.state,release:entry}:{...host.state,configuration:entry};
  const current=(await client.query("SELECT version FROM madevi_schema_migrations ORDER BY version")).rows.map(row=>row.version);
  if(JSON.stringify(current)!==JSON.stringify([...next.release.migrations].sort()))fail("Profil tujuan tidak kompatibel dengan skema aktif.");
  await progress("verifying");
  await artifact();
  const lockPath=join(dirname(host.statePath),"switch.lock");
  const lock=await open(lockPath,"wx",0o600).catch(()=>fail("Kunci perpindahan host tersedia. Operator perlu memeriksa proses dan profil aktif."));
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
    await progress("restarting");
    try {
      await activateProfile(host,next);
      return {details:"Profil host diterapkan. Probe live, ready dan identitas image cocok."};
    } catch {
      await progress("recovering").catch(()=>{});
      try {await activateProfile(host,host.state);}
      catch {fail("Penerapan dan pemulihan otomatis gagal. Operator perlu memeriksa Compose dan probe pada host.");}
      fail("Penerapan gagal. Profil sebelumnya dipulihkan dan lulus probe.");
    }
  } finally {await lock.close();await rm(lockPath,{force:true});}
}


if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await prepareCurrent(process.argv[2],process.argv[3]);
    console.log("Profil awal dan override Compose tercatat. Tidak ada container yang dimulai.");
  } catch(error) {
    console.error(error instanceof OperationError?error.message:"Profil awal belum tersimpan. Periksa isi katalog, izin, dan berkas yang sudah ada.");
    process.exitCode=1;
  }
}
