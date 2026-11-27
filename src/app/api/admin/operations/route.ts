import { observeRoute } from "@/lib/monitoring";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { auth } from "@/lib/auth-config";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { checkDatabaseReadiness } from "@/lib/readiness";
import { consumeRateLimit } from "@/lib/rate-limit";
import { rateHash } from "@/lib/rate-identity";
import { capabilitiesSchema, operationRequest, restoreConfirmation } from "@/lib/operations-control";
import { backupName } from "@/lib/backup-artifact";

const headers={"Cache-Control":"no-store"};
const operationColumns=`id,kind,status,artifact,bytes,requested_at,requested_by,started_at,finished_at,details,phase,retry_of,
  parameters->>'target' AS target,parameters->>'artifactId' AS artifact_id,
  extract(epoch from coalesce(finished_at,now())-started_at)::int AS seconds`;

export async function GET(request:Request) {
  if(!await currentAdmin())return failure("Tidak diizinkan",403);
  const params=new URL(request.url).searchParams;
  const page=z.coerce.number().int().min(1).max(10000).safeParse(params.get("page")??1);
  const backups=z.coerce.number().int().min(1).max(10000).safeParse(params.get("backups")??1);
  if(!page.success||!backups.success)return failure("Halaman tidak valid",400);
  const readiness=await checkDatabaseReadiness(pool);
  try {
    const [jobs,migrations,artifacts,worker,checks]=await Promise.all([
      pool.query(`SELECT ${operationColumns} FROM madevi_operations ORDER BY requested_at DESC,id DESC LIMIT 26 OFFSET $1`,[(page.data-1)*25]),
      pool.query("SELECT version,checksum,applied_at FROM madevi_schema_migrations ORDER BY version DESC"),
      pool.query(`SELECT id,artifact,bytes,finished_at FROM madevi_operations WHERE kind='backup' AND status='completed'
        ORDER BY requested_at DESC,id DESC LIMIT 26 OFFSET $1`,[(backups.data-1)*25]),
      pool.query("SELECT checked_at,capabilities,checked_at>now()-interval '10 minutes' AS fresh FROM madevi_operations_health WHERE id=1"),
      pool.query(`SELECT id,parameters->>'target' AS target,finished_at FROM madevi_operations WHERE kind='target_check'
        AND status='completed' AND finished_at>now()-interval '10 minutes' ORDER BY finished_at DESC LIMIT 5`)
    ]);
    const snapshot=worker.rows[0];
    return Response.json({readiness,jobs:jobs.rows.slice(0,25),next:jobs.rows.length>25,migrations:migrations.rows,
      artifacts:artifacts.rows.slice(0,25),moreArtifacts:artifacts.rows.length>25,
      downloadConfigured:Boolean(process.env.MADEVI_BACKUP_DOWNLOAD_DIR),worker:snapshot??null,checks:checks.rows},{headers});
  } catch {return failure("Riwayat operasi tidak dapat dibaca.",503);}
}

class RequestError extends Error {
  constructor(message:string,readonly status=409){super(message);}
}
async function handlePOST(request:Request) {
  const admin=await currentAdmin();
  if(!admin||!admin.row.madeviMfa||!admin.row.twoFactorEnabled||admin.row.isDemo||!sameOrigin(request))return failure("Diperlukan sesi admin dengan MFA.",403);
  const parsed=operationRequest.safeParse(await bodyJson(request).catch(()=>null));
  if(!parsed.success)return failure("Permintaan operasi tidak valid.",400);
  const input=parsed.data;
  const matches=(job:{kind:string;parameters:Record<string,unknown>;retry_of:string|null})=>
    job.kind===input.kind&&job.retry_of===(input.retryOf??null)&&
    (["target","artifactId","checkId","revision"] as const).every(key=>job.parameters[key]===input[key]);
  let client;
  try {
    const existing=(await pool.query("SELECT kind,status,parameters,retry_of FROM madevi_operations WHERE id=$1 AND requested_by=$2",[input.id,admin.row.id])).rows[0];
    if(existing) {
      if(!matches(existing))return failure("ID permintaan sudah dipakai.",409);
      return Response.json({id:input.id,status:existing.status},{headers});
    }
    if(!await consumeRateLimit(`operations:confirm:${rateHash(admin.row.id)}`,8,300))return failure("Tunggu sebelum memeriksa ulang kata sandi.",429);
    try {
      const result=await auth.api.verifyPassword({headers:request.headers,body:{password:input.password}});
      if(!result.status)throw Error();
    } catch {
      await pool.query(`INSERT INTO madevi_audit(actor_id,action,target_id,outcome) VALUES($1,'operations.confirm',$2,'failed')`,[admin.row.id,input.id]);
      return failure("Identitas belum terkonfirmasi.",403);
    }

    client=await pool.connect();await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7412313)");
    const snapshot=(await client.query("SELECT capabilities FROM madevi_operations_health WHERE id=1 AND checked_at>now()-interval '10 minutes'")).rows[0];
    const cap=capabilitiesSchema.safeParse(snapshot?.capabilities);
    if(!cap.success)throw new RequestError("Worker belum melaporkan kesiapan.");
    const capabilities=cap.data;
    const needsArtifact=["verify","restore","release","host_config"].includes(input.kind);

    if((await client.query("SELECT count(*)::int AS count FROM madevi_operations WHERE status IN ('queued','running')")).rows[0].count>=10) {
      throw new RequestError("Antrean operasi penuh.");
    }
    if(input.retryOf) {
      const retry=(await client.query("SELECT kind,status,parameters FROM madevi_operations WHERE id=$1 AND requested_by=$2",[input.retryOf,admin.row.id])).rows[0];
      if(!retry||retry.kind!==input.kind||retry.status!=="failed"||retry.parameters.target!==input.target||
        retry.parameters.artifactId!==input.artifactId)throw new RequestError("Operasi lama tidak dapat diulang dengan pilihan ini.");
    }
    let artifact:null|string=null;
    if(needsArtifact) {
      const item=(await client.query(`SELECT artifact,finished_at FROM madevi_operations WHERE id=$1 AND kind='backup' AND status='completed'`,[input.artifactId])).rows[0];
      if(!item||!backupName.test(item.artifact??""))throw new RequestError("Artefak backup belum tersedia.");
      artifact=item.artifact;
      if(input.kind==="release"||input.kind==="host_config") {
        const latest=(await client.query("SELECT max(applied_at) AS at FROM madevi_schema_migrations")).rows[0].at;
        if(!item.finished_at||latest>item.finished_at||Date.now()-Number(item.finished_at)>86400000) {
          throw new RequestError("Buat backup baru setelah migrasi terakhir dalam 24 jam terakhir.");
        }
      }
    }
    if(input.kind!=="target_check"&&!capabilities.backup)throw new RequestError("Worker belum menyiapkan direktori dan kunci backup.");
    if(input.kind==="target_check"||input.kind==="restore") {
      if(!capabilities.restoreTarget||input.target!==capabilities.restoreTarget)throw new RequestError("Target berbeda dari konfigurasi host.");
      if(input.kind==="restore") {
        const result=await client.query(`SELECT 1 FROM madevi_operations WHERE id=$1 AND requested_by=$2 AND kind='target_check'
          AND status='completed' AND parameters->>'target'=$3 AND finished_at>now()-interval '10 minutes'`,[input.checkId??null,admin.row.id,input.target]);
        if(!result.rowCount||!input.checkId||!input.artifactId||input.confirmation!==restoreConfirmation(input.target,input.checkId,input.artifactId)) {
          throw new RequestError("Periksa target dan konfirmasi ulang pemulihan.");
        }
      }
    }
    if(input.kind==="release"||input.kind==="host_config") {
      const host=capabilities.host;
      const choice=(input.kind==="release"?host?.releases:host?.configurations)?.find(item=>item.id===input.target);
      const intended=input.kind==="release"?choice:host?.releases.find(item=>item.id===host.active.release);
      const versions=(await client.query("SELECT version FROM madevi_schema_migrations ORDER BY version")).rows.map(row=>row.version);
      if(!host||!choice||choice.revision!==input.revision||input.confirmation!==`TERAPKAN ${choice.id}`)throw new RequestError("Profil tujuan atau konfirmasi berubah.");
      if(JSON.stringify([...(intended?.migrations??[])].sort())!==JSON.stringify(versions))throw new RequestError("Rilis tujuan tidak kompatibel dengan skema aktif.");
    }
    const parameters={target:input.target,artifactId:input.artifactId,checkId:input.checkId,revision:input.revision,
      ...(input.kind==="release"||input.kind==="host_config"?{expectedActive:capabilities.host?.active}:{})};
    const collision=await client.query(`SELECT 1 FROM madevi_operations WHERE status IN ('queued','running') AND id<>$1
      AND (kind=$2 AND parameters=$3::jsonb OR kind IN ('restore','release','host_config') AND $2 IN ('restore','release','host_config'))`,[input.id,input.kind,JSON.stringify(parameters)]);
    if(collision.rowCount)throw new RequestError("Operasi sejenis atau perpindahan lain sedang menunggu atau berjalan.");
    const inserted=await client.query(`INSERT INTO madevi_operations(id,kind,status,artifact,requested_by,parameters,retry_of,phase)
      VALUES($1,$2,'queued',$3,$4,$5,$6,'queued') ON CONFLICT DO NOTHING RETURNING id`,[input.id,input.kind,artifact,admin.row.id,parameters,input.retryOf??null]);
    if(inserted.rowCount)await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)",[admin.row.id,`operations.request.${input.kind}`,input.id]);
    else {
      const duplicate=(await client.query("SELECT kind,parameters,retry_of FROM madevi_operations WHERE id=$1 AND requested_by=$2",[input.id,admin.row.id])).rows[0];
      if(!duplicate||!matches(duplicate))throw new RequestError("Permintaan atau percobaan ulang ini sudah digunakan.");
    }
    await client.query("COMMIT");
    return Response.json({id:input.id,status:"queued"},{status:202,headers});
  } catch(error) {
    await client?.query("ROLLBACK").catch(()=>{});
    return error instanceof RequestError?failure(error.message,error.status):failure("Permintaan operasi belum tersimpan.",503);
  } finally {client?.release();}
}

export const POST=observeRoute("operations.request",handlePOST);
