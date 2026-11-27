import { apiRoute } from "@/lib/api-response";
import { currentAdmin } from "@/lib/access";
import { failure } from "@/lib/api";
import { accountStatus } from "@/lib/account-status";
import { pool } from "@/lib/db";
import { googleSettings, smtpSettings } from "@/lib/env";
import { checkDatabaseReadiness } from "@/lib/readiness";

async function handleGET() {
  if(!await currentAdmin()) return failure("Tidak diizinkan",403);
  try {
    const [users,content,reports,audit,usage,events,latest,readiness,jobs,worker]=await Promise.all([
      pool.query(`SELECT ${accountStatus} AS status,count(*)::int AS count FROM "user" u GROUP BY 1`),
      pool.query("SELECT space,CASE WHEN deleted_at IS NULL THEN workflow_status ELSE 'trash' END AS status,count(*)::int AS count,count(*) FILTER (WHERE deleted_at IS NULL AND published_revision IS NOT NULL AND workflow_status<>'archived')::int AS visible FROM madevi_content GROUP BY 1,2"),
      pool.query("SELECT status,count(*)::int AS count FROM madevi_reports GROUP BY status"),
      pool.query("SELECT action,outcome,actor_id,target_id,created_at FROM madevi_audit ORDER BY created_at DESC,id DESC LIMIT 20"),
      pool.query("SELECT NULL::text AS database_bytes,(SELECT coalesce(sum(octet_length(data)),0)::text FROM madevi_library) AS library_bytes").then(async result=>{
        const size=await pool.query("SELECT pg_database_size(current_database())::text AS bytes").catch(()=>null);
        return {rows:[{...result.rows[0],database_bytes:size?.rows[0]?.bytes??null}]};
      }),
      pool.query("SELECT event,outcome,count(*)::int AS count FROM madevi_security_events WHERE created_at >= now()-interval '24 hours' GROUP BY event,outcome ORDER BY event,outcome"),
      pool.query("SELECT version,checksum,applied_at FROM madevi_schema_migrations ORDER BY version DESC"),
      checkDatabaseReadiness(pool),
      pool.query("SELECT status,count(*)::int AS count FROM madevi_operations GROUP BY status"),
      pool.query("SELECT delivered,failed,checked_at FROM madevi_worker_status WHERE name='dispatch'")
    ]);
    return Response.json({users:users.rows,content:content.rows,reports:reports.rows,audit:audit.rows,usage:usage.rows[0],events:events.rows,migrations:latest.rows,readiness,jobs:jobs.rows,worker:worker.rows[0]??null,integrations:{smtp:Boolean(smtpSettings()),google:Boolean(googleSettings())},sampledAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  } catch {return failure("Ringkasan tidak dapat dibaca",503);}
}

export const GET=apiRoute("/api/admin/summary", "GET", handleGET);
