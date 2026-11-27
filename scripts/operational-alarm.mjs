import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { createSmtpTransport } from "../src/lib/mail.ts";
import { backupConfiguration } from "./encrypted-database.mjs";
import { alertSettings } from "./alarm-settings.mjs";
import { measureDisk, privateStateDirectory, probe } from "./operations-readiness.mjs";

export const signalLabels={
  readiness:"Readiness aplikasi dari host",
  dispatch:"Pembaruan worker pesan",
  operations:"Pembaruan worker operasi",
  failedJobs:"Pekerjaan gagal dalam satu jam terakhir",
  backupCapacity:"Ruang kosong volume backup",
};

export async function updateAlarms(previous,samples,now,settings,notify,checkpoint=async()=>{}) {
  const result=structuredClone(previous);
  for(const kind of Object.keys(signalLabels)) {
    const sample=samples[kind];
    if(typeof sample!=="boolean")continue;
    const state=result[kind]??{failures:0,active:false,notified:false,repeats:0,attemptAt:0,sentAt:0,deliveryAttempts:0,recoveryAttempts:0};
    result[kind]=state;
    if(sample) {
      state.failures=0;
      if(!state.active){delete result[kind];continue;}
      // SMTP failure may mean acceptance was ambiguous. Retry no sooner than 15 minutes.
      if(state.notified||state.attemptAt) {
        if(state.recoveryAttempts>=3||now-state.attemptAt<15*60000)continue;
        state.recoveryAttempts++;
        state.attemptAt=now;
        await checkpoint(result);
        try {await notify(kind,"recovered");}catch {state.deliveryFailed=true;continue;}
      }
      delete result[kind];
      await checkpoint(result);
      continue;
    }
    state.recoveryAttempts=0;
    state.failures=Math.min(state.failures+1,settings.failures);
    if(state.failures<settings.failures&&!state.active)continue;
    state.active=true;
    if(state.notified&&(state.repeats>=settings.maxRepeats||now-state.sentAt<settings.repeatMs))continue;
    if(state.deliveryAttempts>=3||state.attemptAt&&now-state.attemptAt<15*60000)continue;
    state.deliveryAttempts++;
    state.attemptAt=now;
    await checkpoint(result);
    try {
      await notify(kind,state.notified?"repeat":"opened");
      if(state.notified)state.repeats++;
      state.notified=true;state.sentAt=now;state.deliveryFailed=false;state.deliveryAttempts=0;
    } catch {state.deliveryFailed=true;}
    await checkpoint(result);
  }
  return result;
}

async function observations() {
  const collectDatabase=async()=>{
    let pool;
    try {
      pool=createDatabasePool(undefined,1);
      const result=(await pool.query(`SELECT
        (SELECT checked_at>now()-interval '10 minutes' FROM madevi_worker_status WHERE name='dispatch') AS dispatch,
        (SELECT checked_at>now()-interval '10 minutes' OR EXISTS
          (SELECT 1 FROM madevi_operations WHERE status='running' AND progress_at>now()-interval '17 minutes')
          FROM madevi_operations_health WHERE id=1) AS operations,
        NOT EXISTS (SELECT FROM madevi_operations WHERE status='failed' AND finished_at>now()-interval '1 hour')
          AND NOT EXISTS (SELECT FROM madevi_message_jobs WHERE status='failed' AND updated_at>now()-interval '1 hour') AS "failedJobs"`)).rows[0];
      return {...result,dispatch:result.dispatch??false,operations:result.operations??false};
    } catch {return {};}
    finally {await pool?.end();}
  };
  const [ready,signals,disk]=await Promise.all([
    probe("ready"),collectDatabase(),
    backupConfiguration({create:false}).then(measureDisk).catch(()=>null)
  ]);
  return {...signals,readiness:Boolean(ready?.ok),disk};
}

async function readState(path) {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK).catch(error=>{
    if(error.code!=="ENOENT")throw error;
    return null;
  });
  if(!file)return {};
  try {
    const info=await file.stat();
    if(!info.isFile()||info.size>16384||(info.mode&0o077)!==0)throw Error("invalid_alarm_state");
    const data=JSON.parse(await file.readFile("utf8"));
    if(!data||Array.isArray(data)||typeof data!=="object")throw Error("invalid_alarm_state");
    for(const [key,item] of Object.entries(data)) {
      if(!Object.hasOwn(signalLabels,key)||!item||
        !["failures","repeats","attemptAt","sentAt","deliveryAttempts","recoveryAttempts"].every(field=>Number.isSafeInteger(item[field])&&item[field]>=0)||
        typeof item.active!=="boolean"||typeof item.notified!=="boolean")throw Error("invalid_alarm_state");
    }
    return data;
  } finally {await file.close();}
}

async function persist(filename,state) {
  const pending=filename+"."+randomUUID();
  try {
    await writeFile(pending,JSON.stringify(state),{mode:0o600,flag:"wx",flush:true});
    await rename(pending,filename);
  } finally {await rm(pending,{force:true});}
}

export async function smtpAlarm(settings,kind,event) {
  const transport=createSmtpTransport(settings.smtp);
  const labels={opened:"Gangguan",repeat:"Gangguan berlanjut",recovered:"Pemulihan"};
  try {
    const result=await transport.sendMail({
      from:settings.smtp.from,to:settings.recipient,subject:`Madevi · ${labels[event]}`,
      text:`${signalLabels[kind]}\n${labels[event]} pada ${new Date().toISOString()}. Periksa panduan operasi dan journal worker.`,
    });
    if(!result.accepted?.length)throw Error("delivery_unconfirmed");
  } finally {transport.close();}
}

async function main() {
  try {
    const settings=alertSettings();
    if(!settings){console.log(JSON.stringify({event:"ops.alarm",outcome:"inactive"}));return;}
    const directory=await privateStateDirectory(settings.directory);
    const filename=join(directory,"alarm-state.json");
    const old=await readState(filename);
    const {disk,...samples}=await observations();
    if(disk&&BigInt(disk.total)>0n)samples.backupCapacity=BigInt(disk.available)*100n>=BigInt(disk.total)*BigInt(settings.freePercent);
    const state=await updateAlarms(old,samples,Date.now(),settings,async(kind,event)=>{
      await smtpAlarm(settings,kind,event);
      console.log(JSON.stringify({event:"ops.alarm",signal:kind,outcome:event}));
    },current=>persist(filename,current));
    await persist(filename,state);
    if(Object.values(state).some(item=>item.deliveryFailed)) {
      console.error(JSON.stringify({event:"ops.alarm",outcome:"delivery_failed"}));
      process.exitCode=1;
    }
  } catch {
    console.error(JSON.stringify({event:"ops.alarm",outcome:"failed"}));
    process.exitCode=1;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
