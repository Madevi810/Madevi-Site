import { apiRoute } from "@/lib/api-response";
import { currentAdmin } from "@/lib/access";
import { failure } from "@/lib/api";
import { pool } from "@/lib/db";
import { monitoredLabels } from "@/lib/monitoring";
import { checkDatabaseReadiness } from "@/lib/readiness";

async function handleGET() {
  if(!await currentAdmin())return failure("Tidak diizinkan.",403);
  const since=new Date(Math.floor(Date.now()/3600000)*3600000-23*3600000).toISOString();
  try {
    const [requests,host,incidents,operations,messages,dispatch,database]=await Promise.all([
      pool.query(`SELECT route,sum(count)::text AS count,
        coalesce(sum(count) FILTER(WHERE result='error'),0)::text AS errors,
        coalesce(sum(count) FILTER(WHERE result='client'),0)::text AS client,
        round(sum(total_ms)/sum(count))::int AS average,max(max_ms) AS maximum,max(updated_at) AS at
        FROM madevi_monitor_buckets WHERE hour>=$1 AND route=ANY($2::text[]) GROUP BY route`,[since,Object.keys(monitoredLabels)]),
      pool.query("SELECT checked_at,metrics,checked_at>now()-interval '10 minutes' AS fresh FROM madevi_operations_health WHERE id=1"),
      pool.query("SELECT source,opened_at,resolved_at,detail FROM madevi_monitor_incidents ORDER BY resolved_at IS NULL DESC,opened_at DESC LIMIT 20"),
      pool.query(`SELECT kind,count(*) FILTER(WHERE status='queued')::int AS queued,count(*) FILTER(WHERE status='running')::int AS running,
        count(*) FILTER(WHERE status='failed' AND finished_at>=$1)::int AS failed,
        count(*) FILTER(WHERE status='completed' AND finished_at>=$1)::int AS completed,
        round(avg(extract(epoch FROM finished_at-started_at)) FILTER(WHERE finished_at>=$1))::int AS average
        FROM madevi_operations GROUP BY kind`,[since]),
      pool.query(`SELECT count(*) FILTER(WHERE status='scheduled' AND run_at<=now())::int AS due,
        count(*) FILTER(WHERE status='scheduled' AND run_at>now())::int AS scheduled,
        count(*) FILTER(WHERE status='failed')::int AS failed FROM madevi_message_jobs`),
      pool.query("SELECT checked_at,delivered,failed,checked_at>now()-interval '10 minutes' AS fresh FROM madevi_worker_status WHERE name='dispatch'"),
      checkDatabaseReadiness(pool)
    ]);
    return Response.json({since,checkedAt:new Date().toISOString(),labels:monitoredLabels,requests:requests.rows,
      host:host.rows[0]??null,incidents:incidents.rows,operations:operations.rows,messages:messages.rows[0],
      dispatch:dispatch.rows[0]??null,database},{headers:{"Cache-Control":"no-store"}});
  } catch {return failure("Data monitoring gagal dibaca.",503);}
}

export const GET=apiRoute("/api/admin/monitoring", "GET", handleGET);
