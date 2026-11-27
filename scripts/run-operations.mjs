import { randomUUID } from "node:crypto";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import { accountRestricted } from "../src/lib/account-status.ts";
import { sessionUsable } from "../src/lib/session-policy.ts";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { operationLock, OperationError, runEncryptedOperation } from "./encrypted-database.mjs";
import { integerSetting } from "./maintenance.mjs";
import { localChecks, measureDisk, probe } from "./operations-readiness.mjs";
import { hostChoices, runHostRollback } from "./host-profile.mjs";

async function incident(client,source,healthy,detail) {
  if(healthy) {
    await client.query("UPDATE madevi_monitor_incidents SET resolved_at=now() WHERE source=$1 AND resolved_at IS NULL",[source]);
  } else {
    await client.query("INSERT INTO madevi_monitor_incidents(id,source,detail) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[randomUUID(),source,detail]);
  }
}

const pool=createDatabasePool(undefined,1);
let client;
try {
  client=await pool.connect();
  if(!(await client.query("SELECT pg_try_advisory_lock($1) AS locked",[operationLock])).rows[0].locked) {
    console.log("Worker operasi sedang aktif.");
  } else {
    const {backup,host,restoreTarget,checks}=await localChecks();
    const [live,ready,disk]=await Promise.all([probe("live"),probe("ready"),measureDisk(backup)]);
    const memory={total:totalmem(),free:freemem()};
    const metrics={live,ready,disk,memory,load:loadavg()[0],cores:availableParallelism(),checks};
    const previous=(await client.query("SELECT checked_at,checked_at<now()-interval '10 minutes' AS stale FROM madevi_operations_health WHERE id=1")).rows[0];
    if(previous?.stale) {
      await client.query(`INSERT INTO madevi_monitor_incidents(id,source,opened_at,resolved_at,detail)
        VALUES($1,'worker.heartbeat',$2::timestamptz+interval '10 minutes',now(),'Worker kembali mengirim pengukuran.')`,[randomUUID(),previous.checked_at]);
    }
    await client.query(`INSERT INTO madevi_operations_health(id,capabilities,metrics) VALUES(1,$1,$2)
      ON CONFLICT(id) DO UPDATE SET capabilities=$1,metrics=$2,checked_at=now()`,[{backup:Boolean(backup),restoreTarget,host:hostChoices(host)},metrics]);
    await incident(client,"live",Boolean(live?.ok),"Probe proses dari host gagal.");
    await incident(client,"ready",Boolean(ready?.ok),"Probe kesiapan dari host gagal.");
    const interrupted=await client.query(`WITH ended AS (
      UPDATE madevi_operations SET status='failed',phase='interrupted',finished_at=now(),progress_at=now(),
        details='Worker terhenti. Periksa hasil dan target sebelum meminta ulang.' WHERE status='running'
        RETURNING id,kind,requested_by
    ), audited AS (
      INSERT INTO madevi_audit(actor_id,action,target_id,outcome)
      SELECT coalesce(requested_by,'worker'),'operations.result.'||kind,id::text,'failed' FROM ended
    ) SELECT kind FROM ended`);
    for(const item of interrupted.rows)await incident(client,"operation."+item.kind,false,"Pekerjaan sebelumnya berhenti sebelum hasil tercatat.");
    const claim=await client.query(`UPDATE madevi_operations SET status='running',started_at=now(),phase='starting',progress_at=now()
      WHERE id=(SELECT id FROM madevi_operations WHERE status='queued' ORDER BY requested_at,id LIMIT 1) RETURNING *`);
    let job=claim.rows[0];
    if(!job&&backup) {
      const hours=integerSetting(process.env.MADEVI_ROUTINE_BACKUP_HOURS,0,0,720);
      if(hours>0) {
        job=(await client.query(`INSERT INTO madevi_operations(id,kind,status,started_at,phase,progress_at,parameters)
          SELECT $1,'backup','running',now(),'starting',now(),'{"routine":true}'::jsonb
          WHERE NOT EXISTS (SELECT 1 FROM madevi_operations WHERE kind='backup' AND parameters @> '{"routine":true}'
            AND requested_at>now()-make_interval(hours=>$2)) RETURNING *`,[randomUUID(),hours])).rows[0];
      }
    }
    if(job) {
      const progress=async phase=>{await client.query("UPDATE madevi_operations SET phase=$2,progress_at=now() WHERE id=$1",[job.id,phase]);};
      try {
        const switching=["release","host_config"].includes(job.kind);
        if(!(job.parameters.routine===true&&job.kind==="backup"&&!job.requested_by)) {
          const requester=await client.query(`SELECT 1 FROM "user" u WHERE u.id=$1 AND u."madeviRole"='admin'
            AND u."twoFactorEnabled" AND NOT u."isDemo" AND NOT ${accountRestricted}`,[job.requested_by]);
          if(!requester.rowCount)throw new OperationError("Kewenangan admin peminta tidak lagi berlaku.");
        }
        if(switching||job.kind==="restore") {
          const authorization=await client.query(`SELECT 1 FROM "session" s JOIN "user" u ON u.id=s."userId"
            WHERE s.id=$1 AND u.id=$2 AND s."madeviMfa" AND ${sessionUsable}`,[job.parameters.requestSession??null,job.requested_by]);
          if(!authorization.rowCount)throw new OperationError("Sesi MFA peminta berakhir. Ajukan kembali pada sesi aktif.");
        }
        if(job.kind==="restore") {
          const source=await client.query(`SELECT 1 FROM madevi_operations
            WHERE id=$1 AND artifact=$2 AND kind='backup' AND status='completed'`,[job.parameters.artifactId,job.artifact]);
          const check=await client.query(`SELECT 1 FROM madevi_operations WHERE id=$1 AND requested_by=$2 AND kind='target_check'
            AND status='completed' AND parameters->>'target'=$3 AND finished_at>now()-interval '10 minutes'`,
            [job.parameters.checkId,job.requested_by,job.parameters.target]);
          if(!source.rowCount||!check.rowCount)throw new OperationError("Artefak atau pemeriksaan target sudah tidak berlaku.");
        }
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
        await client.query(`WITH ended AS (
          UPDATE madevi_operations SET status='completed',phase='done',artifact=coalesce($2,artifact),
          bytes=$3,details=$4,finished_at=now(),progress_at=now() WHERE id=$1 RETURNING id,kind,requested_by
        ) INSERT INTO madevi_audit(actor_id,action,target_id)
          SELECT coalesce(requested_by,'worker'),'operations.result.'||kind,id::text FROM ended`,
          [job.id,result.artifact??null,result.bytes??null,result.details]);
        await incident(client,"operation."+job.kind,true,"");
        console.log(JSON.stringify({event:"ops.job",id:job.id,kind:job.kind,outcome:"completed"}));
      } catch(error) {
        const details=error instanceof OperationError?error.message:"Operasi gagal. Periksa konfigurasi, alat host, dan izin.";
        await client.query(`WITH ended AS (
          UPDATE madevi_operations SET status='failed',phase='failed',details=$2,finished_at=now(),progress_at=now()
          WHERE id=$1 RETURNING id,kind,requested_by
        ) INSERT INTO madevi_audit(actor_id,action,target_id,outcome)
          SELECT coalesce(requested_by,'worker'),'operations.result.'||kind,id::text,'failed' FROM ended`,[job.id,details]);
        await incident(client,"operation."+job.kind,false,details);
        console.error(JSON.stringify({event:"ops.job",id:job.id,kind:job.kind,outcome:"failed"}));
        process.exitCode=1;
      }
    }
  }
} catch {
  console.error("Worker gagal terhubung atau menyimpan hasil operasi.");
  process.exitCode=1;
} finally {client?.release();await pool.end();}
