import { pathToFileURL } from "node:url";
import { databaseUrl } from "../src/lib/env.ts";
import { createDatabasePool } from "../src/lib/postgres.ts";

export function integerSetting(raw, fallback, min, max) {
  const value=raw===undefined||raw===""?fallback:Number(raw);
  if(!Number.isInteger(value)||value<min||value>max||raw&&!/^\d+$/.test(raw))throw Error("invalid_setting");
  return value;
}

export function maintenanceSettings(env=process.env) {
  const mode=env.MADEVI_MAINTENANCE_MODE||"dry-run";
  if(!["off","dry-run","prune"].includes(mode))throw Error("invalid_maintenance_mode");
  return {mode,batch:integerSetting(env.MADEVI_MAINTENANCE_BATCH,500,1,5000),
    limits:integerSetting(env.MADEVI_RATE_RETENTION_DAYS,7,2,90),
    metrics:integerSetting(env.MADEVI_METRICS_RETENTION_DAYS,7,2,90),
    backupDays:integerSetting(env.MADEVI_BACKUP_RETENTION_DAYS,30,7,365)};
}

const groups=[
  {label:"rate_limits",table:"madevi_rate_limits",columns:"key",match:"t.key=b.key",age:"window_start",policy:"limits"},
  {label:"monitor_buckets",table:"madevi_monitor_buckets",columns:"hour,route,result",match:"(t.hour,t.route,t.result)=(b.hour,b.route,b.result)",age:"hour",policy:"metrics"},
];

export async function maintain(client,{mode,batch,limits,metrics,backupDays}) {
  if(mode==="off")return {mode};
  const summary={mode};
  for(const {label,table,columns,match,age,policy} of groups) {
    const select=`SELECT ${columns} FROM ${table} WHERE ${age}<now()-make_interval(days=>$1)
      ORDER BY ${age},${columns} LIMIT $2`;
    const statement=mode==="prune"
      ? `WITH b AS (${select}), removed AS (DELETE FROM ${table} t USING b WHERE ${match}
        AND t.${age}<now()-make_interval(days=>$1) RETURNING 1) SELECT count(*)::int AS count FROM removed`
      : `SELECT count(*)::int AS count FROM (${select}) AS b`;
    summary[label]=(await client.query(statement,[{limits,metrics}[policy],batch])).rows[0].count;
  }
  // A local catalog has no evidence of verified copies kept off host. Preserve all files.
  // Exclude the newest three and the last successfully restored artifact even from review.
  summary.backupReview=(await client.query(`SELECT count(*)::int AS count FROM (
    SELECT id FROM madevi_operations b WHERE b.kind='backup' AND b.status='completed'
      AND b.finished_at<now()-make_interval(days=>$1) AND b.artifact IS NOT NULL
      AND b.id NOT IN (SELECT n.id FROM madevi_operations n WHERE n.kind='backup' AND n.status='completed'
        AND n.artifact IS NOT NULL ORDER BY n.finished_at DESC NULLS LAST,n.id DESC LIMIT 3)
      AND b.artifact IS DISTINCT FROM (SELECT r.artifact FROM madevi_operations r
        WHERE r.kind='restore' AND r.status='completed' ORDER BY r.finished_at DESC NULLS LAST LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM madevi_operations p WHERE p.status IN ('queued','running') AND p.artifact=b.artifact)
      ORDER BY b.finished_at,b.id LIMIT $2
    ) AS review`,[backupDays,batch])).rows[0].count;
  return summary;
}

export function maintenanceConnection(mode,env=process.env) {
  const database=databaseUrl(env);
  if(mode!=="prune")return database;
  if(!env.MADEVI_MAINTENANCE_DATABASE_URL)throw Error("maintenance_role_required");
  const dedicated=databaseUrl({...env,DATABASE_URL:env.MADEVI_MAINTENANCE_DATABASE_URL});
  const base=new URL(database), other=new URL(dedicated);
  if(base.host!==other.host||base.pathname!==other.pathname||!other.username||other.username===base.username) {
    throw Error("maintenance_target_mismatch");
  }
  return dedicated;
}

async function main() {
  let pool,client;
  try {
    const settings=maintenanceSettings();
    if(process.argv.slice(2).includes("--dry-run"))settings.mode="dry-run";
    if(settings.mode==="off"){console.log(JSON.stringify({event:"ops.maintenance",mode:"off"}));return;}
    pool=createDatabasePool(maintenanceConnection(settings.mode),1);
    client=await pool.connect();
    if(!(await client.query("SELECT pg_try_advisory_lock(7412315) AS locked")).rows[0].locked)return;
    const summary=await maintain(client,settings);
    console.log(JSON.stringify({event:"ops.maintenance",...summary}));
  } catch {
    console.error(JSON.stringify({event:"ops.maintenance",outcome:"failed"}));
    process.exitCode=1;
  } finally {client?.release();await pool?.end();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
