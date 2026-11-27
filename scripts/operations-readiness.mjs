import { constants } from "node:fs";
import { access, lstat, realpath, statfs } from "node:fs/promises";
import { execFile } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { backupDirectory } from "../src/lib/backup-artifact.ts";
import { configurationIssues } from "../src/lib/env.ts";
import { checkDatabaseReadiness } from "../src/lib/readiness.ts";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { backupConfiguration, targetConfiguration } from "./encrypted-database.mjs";
import { hostProfile } from "./host-profile.mjs";
import { integerSetting, maintenanceSettings } from "./maintenance.mjs";
import { alertSettings } from "./alarm-settings.mjs";

const execute=promisify(execFile);
export const status={ready:"ready",missing:"unconfigured",off:"inactive",failed:"failed",stale:"stale",operator:"operator_check"};
const row=(state,detail)=>({state,detail});

export async function probe(path) {
  try {
    const started=performance.now();
    const response=await fetch(`http://127.0.0.1:3000/api/health/${path}`,{redirect:"error",signal:AbortSignal.timeout(2500)});
    return {status:response.status,ms:Math.round(performance.now()-started),ok:response.ok};
  } catch {return null;}
}

export async function privateStateDirectory(directory) {
  if(!isAbsolute(directory)||resolve(directory)!==directory||await realpath(directory)!==directory)throw Error("invalid_state_directory");
  const checkout=await realpath(fileURLToPath(new URL("../",import.meta.url)));
  const fromCheckout=relative(checkout,directory);
  if(!fromCheckout||fromCheckout!==".."&&!fromCheckout.startsWith(".."+sep))throw Error("state_directory_in_checkout");
  const info=await lstat(directory);
  if(!info.isDirectory()||(info.mode&0o077)!==0||(process.getuid&&info.uid!==process.getuid()))throw Error("invalid_state_permissions");
  await access(directory,constants.R_OK|constants.W_OK|constants.X_OK);
  return directory;
}

export async function measureDisk(backup) {
  if(!backup)return null;
  return statfs(backup.directory,{bigint:true}).then(v=>({total:String(v.blocks*v.bsize),available:String(v.bavail*v.bsize)})).catch(()=>null);
}

async function checkBackup() {
  if(!process.env.MADEVI_BACKUP_DIR&&!process.env.MADEVI_BACKUP_KEY)return {check:row(status.missing,"Direktori dan kunci backup belum diisi."),backup:null};
  try {
    const backup=await backupConfiguration({create:false});
    await access(backup.directory,constants.R_OK|constants.W_OK|constants.X_OK);
    await Promise.all(["pg_dump","pg_restore"].map(tool=>execute(tool,["--version"],{timeout:3000,maxBuffer:4000})));
    return {check:row(status.ready,"Direktori dapat diakses dan klien PostgreSQL tersedia. Uji backup dan restore tetap diperlukan."),backup};
  } catch {return {check:row(status.failed,"Periksa direktori privat, kunci, izin dan klien PostgreSQL."),backup:null};}
}

export async function localChecks() {
  const backupResult=await checkBackup();
  const checks={configuration:configurationIssues().length?row(status.failed,"Periksa kelompok konfigurasi dengan check:ready."):row(status.ready,"Format konfigurasi proses valid."),backup:backupResult.check};
  let host=null, restoreTarget=null;
  try {
    host=await hostProfile();
    checks.host=host?row(status.operator,"Katalog dan profil aktif valid. Periksa akses Docker, image lokal dan kecocokan skema."):
      row(status.off,"Katalog rollback host belum diaktifkan.");
  } catch {checks.host=row(status.failed,"Katalog atau profil aktif tidak valid.");}
  try {
    if(process.env.MADEVI_RESTORE_DATABASE_URL)restoreTarget=targetConfiguration().identity;
    checks.restore=restoreTarget?row(status.operator,"Target terkonfigurasi. Jalankan pemeriksaan target kosong dari admin."):row(status.missing,"Target restore terpisah belum diisi.");
  } catch {checks.restore=row(status.failed,"Konfigurasi target terpisah belum valid.");}
  const download=process.env.MADEVI_BACKUP_DOWNLOAD_DIR;
  checks.download=download?row(status.operator,"Periksa mount baca-saja dan izin pada identitas runtime container."):row(status.off,"Unduhan belum diminta pada konfigurasi host.");
  if(download&&process.env.MADEVI_BACKUP_DIR&&download===process.env.MADEVI_BACKUP_DIR) {
    try {await backupDirectory(download);await access(download,constants.R_OK|constants.X_OK);}
    catch {checks.download=row(status.failed,"Jalur unduhan host tidak dapat dibaca atau tidak privat.");}
  }
  try {
    const config=alertSettings();
    if(config)await privateStateDirectory(config.directory);
    checks.alert=config?row(status.operator,"Kanal SMTP dan direktori status valid. Pengiriman perlu dibuktikan oleh operator."):row(status.off,"Alarm SMTP belum diaktifkan.");
  } catch {checks.alert=row(status.failed,"Periksa penerima, SMTP, ambang dan direktori privat alarm.");}
  try {
    const settings=maintenanceSettings();
    const hours=integerSetting(process.env.MADEVI_ROUTINE_BACKUP_HOURS,0,0,720);
    checks.schedule=row(hours&&!backupResult.backup?status.failed:status.operator,
      hours&&!backupResult.backup?"Backup rutin diminta tetapi operasi backup belum siap.":
      `Pemeliharaan ${settings.mode}; backup rutin ${hours?(`setiap ${hours} jam`):"nonaktif"}. Periksa timer pada host.`);
  } catch {checks.schedule=row(status.failed,"Konfigurasi interval atau retensi tidak valid.");}
  return {checks,backup:backupResult.backup,host,restoreTarget};
}

export async function workerChecks(client) {
  const result=(await client.query(`SELECT
    (SELECT checked_at FROM madevi_worker_status WHERE name='dispatch') AS dispatch,
    (SELECT checked_at FROM madevi_operations_health WHERE id=1) AS operations`)).rows[0];
  return Object.fromEntries(Object.entries(result).map(([name,at])=>[name,!at?row(status.operator,"Worker belum melapor. Periksa timer pada host."):
    Date.now()-new Date(at).getTime()>600000?{...row(status.stale,"Pembaruan worker lebih dari sepuluh menit."),at}:
    {...row(status.ready,"Worker telah mengirim hasil pemeriksaan."),at}]));
}

async function main() {
  const {checks}=await localChecks();
  let pool;
  try {
    pool=createDatabasePool(undefined,1);
    const result=await checkDatabaseReadiness(pool);
    checks.database=result==="ready"?row(status.ready,"Koneksi dan skema terverifikasi."):row(status.failed,result==="schema_pending"?"Skema belum siap.":"Koneksi database gagal.");
    if(result==="ready")Object.assign(checks,await workerChecks(pool));
  } catch {checks.database=row(status.failed,"Koneksi atau pemeriksaan database gagal.");}
  finally {await pool?.end();}
  console.log(JSON.stringify({event:"ops.readiness",sampledAt:new Date().toISOString(),checks},null,2));
  if(Object.values(checks).some(item=>item.state===status.failed||item.state===status.stale))process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
