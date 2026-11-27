import { randomUUID } from "node:crypto";
import { statfs } from "node:fs/promises";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { backupConfiguration, operationLock, OperationError, runEncryptedOperation, targetConfiguration } from "./encrypted-database.mjs";
import { hostChoices, hostProfile, runHostRollback } from "./host-profile.mjs";

async function incident(client,source,healthy,detail) {
  if(healthy) {
    await client.query("UPDATE madevi_monitor_incidents SET resolved_at=now() WHERE source=$1 AND resolved_at IS NULL",[source]);
  } else {
    await client.query("INSERT INTO madevi_monitor_incidents(id,source,detail) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[randomUUID(),source,detail]);
  }
}

async function probe(path) {
  try {
    const started=performance.now();
    const response=await fetch(`http://127.0.0.1:3000/api/health/${path}`,{redirect:"error",signal:AbortSignal.timeout(2500)});
    return {status:response.status,ms:Math.round(performance.now()-started),ok:response.ok};
  } catch {return null;}
}

const pool=createDatabasePool(undefined,1);
let client;
try {
  client=await pool.connect();
  if(!(await client.query("SELECT pg_try_advisory_lock($1) AS locked",[operationLock])).rows[0].locked) {
    console.log("Worker operasi sedang aktif.");
  } else {
    const backup=await backupConfiguration().catch(()=>null);
    const host=await hostProfile().catch(()=>null);
    let restoreTarget=null;
    try {restoreTarget=targetConfiguration().identity;}catch {}
    const [live,ready,disk]=await Promise.all([
      probe("live"),probe("ready"),
      backup?statfs(backup.directory,{bigint:true}).then(v=>({total:String(v.blocks*v.bsize),available:String(v.bavail*v.bsize)})).catch(()=>null):null
    ]);
    const memory={total:totalmem(),free:freemem()};
    const metrics={live,ready,disk,memory,load:loadavg()[0],cores:availableParallelism()};
    const previous=(await client.query("SELECT checked_at,checked_at<now()-interval '10 minutes' AS stale FROM madevi_operations_health WHERE id=1")).rows[0];
    if(previous?.stale) {
      await client.query(`INSERT INTO madevi_monitor_incidents(id,source,opened_at,resolved_at,detail)
        VALUES($1,'worker.heartbeat',$2::timestamptz+interval '10 minutes',now(),'Worker kembali mengirim pengukuran.')`,[randomUUID(),previous.checked_at]);
    }
    await client.query(`INSERT INTO madevi_operations_health(id,capabilities,metrics) VALUES(1,$1,$2)
      ON CONFLICT(id) DO UPDATE SET capabilities=$1,metrics=$2,checked_at=now()`,[{backup:Boolean(backup),restoreTarget,host:hostChoices(host)},metrics]);
    await incident(client,"live",Boolean(live?.ok),"Probe proses dari host gagal.");
    await incident(client,"ready",Boolean(ready?.ok),"Probe kesiapan dari host gagal.");
    await client.query("DELETE FROM madevi_monitor_incidents WHERE resolved_at<now()-interval '90 days'");
    await client.query("DELETE FROM madevi_monitor_buckets WHERE hour<now()-interval '7 days'");
    const interrupted=await client.query(`UPDATE madevi_operations SET status='failed',phase='interrupted',finished_at=now(),
      details='Worker terhenti. Periksa hasil dan target sebelum meminta ulang.' WHERE status='running' RETURNING kind`);
    for(const item of interrupted.rows)await incident(client,"operation."+item.kind,false,"Pekerjaan sebelumnya berhenti sebelum hasil tercatat.");
    const claim=await client.query(`UPDATE madevi_operations SET status='running',started_at=now(),phase='starting'
      WHERE id=(SELECT id FROM madevi_operations WHERE status='queued' ORDER BY requested_at,id LIMIT 1) RETURNING *`);
    const job=claim.rows[0];
    if(job) {
      const progress=async phase=>{await client.query("UPDATE madevi_operations SET phase=$2 WHERE id=$1",[job.id,phase]);};
      try {
        const requester=await client.query(`SELECT 1 FROM "user" WHERE id=$1 AND "madeviRole"='admin' AND "twoFactorEnabled" AND NOT "isDemo" AND NOT suspended`,[job.requested_by]);
        if(!requester.rowCount)throw new OperationError("Kewenangan admin peminta tidak lagi berlaku.");
        const switching=["release","host_config"].includes(job.kind);
        if(switching) {
          const previous=job.parameters.expectedActive;
          if(!host||!previous||host.state.release.id!==previous.release||host.state.configuration.id!==previous.configuration) {
            throw new OperationError("Profil sumber telah berubah sejak permintaan dibuat.");
          }
          const fresh=await client.query(`SELECT 1 FROM madevi_operations WHERE id=$1 AND artifact=$2 AND kind='backup'
            AND status='completed' AND finished_at>now()-interval '24 hours'
            AND finished_at>=(SELECT max(applied_at) FROM madevi_schema_migrations)`,[job.parameters.artifactId,job.artifact]);
          if(!fresh.rowCount)throw new OperationError("Backup kedaluwarsa atau mendahului migrasi terakhir.");
        }
        const result=switching
          ? await runHostRollback({host,kind:job.kind,target:job.parameters.target,revision:job.parameters.revision,client,progress,
              artifact:()=>runEncryptedOperation({operation:"verify",artifact:job.artifact,progress})})
          : await runEncryptedOperation({operation:job.kind,id:job.id,artifact:job.artifact,
              confirmation:`RESTORE:${job.parameters.target??""}`,progress});
        await client.query(`UPDATE madevi_operations SET status='completed',phase='done',artifact=coalesce($2,artifact),
          bytes=$3,details=$4,finished_at=now() WHERE id=$1`,[job.id,result.artifact??null,result.bytes??null,result.details]);
        await incident(client,"operation."+job.kind,true,"");
      } catch(error) {
        const details=error instanceof OperationError?error.message:"Operasi gagal. Periksa konfigurasi, alat host, dan izin.";
        await client.query("UPDATE madevi_operations SET status='failed',phase='failed',details=$2,finished_at=now() WHERE id=$1",[job.id,details]);
        await incident(client,"operation."+job.kind,false,details);
        process.exitCode=1;
      }
    }
  }
} catch {
  console.error("Worker gagal terhubung atau menyimpan hasil operasi.");
  process.exitCode=1;
} finally {client?.release();await pool.end();}
