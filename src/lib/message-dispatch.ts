import type { Pool } from "pg";
import { accountRestricted } from "./account-status.ts";

export async function dispatchMessages(pool:Pool, batch = 10, requestedId?:string) {
  const client = await pool.connect();
  let delivered = 0, failed = 0;
  try {
    for (let count=0; count<batch; count++) {
      await client.query("BEGIN");
      let jobId:string|undefined;
      try {
        const selected = await client.query<{id:string}>(`SELECT id FROM madevi_message_jobs
          WHERE status='scheduled' AND run_at<=now() AND ($1::uuid IS NULL OR id=$1)
          ORDER BY run_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,[requestedId??null]);
        jobId = selected.rows[0]?.id;
        if(!jobId) { await client.query("COMMIT"); break; }
        await client.query("SAVEPOINT dispatch_job");
        const sent = await client.query(`INSERT INTO madevi_notifications(id,category,recipient_id,title,body,created_by,job_id)
          SELECT gen_random_uuid(),'system',u.id,replace(replace(j.title,'{{nama}}',left(u.name,80)),'{{situs}}','Madevi'),
          replace(replace(j.body,'{{nama}}',left(u.name,80)),'{{situs}}','Madevi'),j.author,j.id
          FROM madevi_message_jobs j JOIN "user" u ON j.audience <> 'user' OR u.id=j.recipient_id
          WHERE j.id=$1 AND NOT ${accountRestricted} AND
          (j.audience IN ('all','user') OR (j.audience='verified')=u."emailVerified")
          ON CONFLICT DO NOTHING`,[jobId]);
        if(!sent.rowCount) throw Error("no-recipients");
        await client.query(`UPDATE madevi_message_jobs SET status='sent',attempts=attempts+1,
          sent_at=now(),deliveries=$2,failure_code=NULL,updated_at=now() WHERE id=$1`,[jobId,sent.rowCount]);
        await client.query("COMMIT");
        delivered++;
      } catch(error) {
        if(!jobId) throw error;
        await client.query("ROLLBACK TO SAVEPOINT dispatch_job");
        await client.query("UPDATE madevi_message_jobs SET status='failed',attempts=attempts+1,failure_code=$2,updated_at=now() WHERE id=$1",
          [jobId,error instanceof Error&&error.message==="no-recipients"?"no_recipients":"database_write"]);
        await client.query("COMMIT");
        failed++;
      }
    }
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
  } finally {client.release();}
  return {delivered,failed};
}
