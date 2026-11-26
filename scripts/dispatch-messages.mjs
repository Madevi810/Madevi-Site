import { createDatabasePool } from "../src/lib/postgres.ts";
import { dispatchMessages } from "../src/lib/message-dispatch.ts";

let pool;
try {
  pool = createDatabasePool(undefined, 2);
  const result = await dispatchMessages(pool);
  await pool.query(`INSERT INTO madevi_worker_status(name,delivered,failed) VALUES('dispatch',$1,$2)
    ON CONFLICT(name) DO UPDATE SET delivered=$1,failed=$2,checked_at=now()`,[result.delivered,result.failed]);
  console.log(JSON.stringify({event:"jobs.dispatch", ...result}));
  if(result.failed) process.exitCode=1;
} catch {
  console.error(JSON.stringify({event:"jobs.dispatch", outcome:"unavailable"}));
  process.exitCode=1;
} finally { await pool?.end(); }
