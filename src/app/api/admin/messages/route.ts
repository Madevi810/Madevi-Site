import { observeRoute } from "@/lib/monitoring";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { failure, bodyJson, sameOrigin } from "@/lib/api";
import { dispatchMessages, messageAudience } from "@/lib/message-dispatch";
import { pool } from "@/lib/db";
import { accountRestricted } from "@/lib/account-status";

const pattern = (max:number) => z.string().trim().min(1).max(max).refine(value => {
  const residual = value.replace(/{{(?:nama|situs)}}/g,"");
  return !/[{}]/.test(residual) && value.replaceAll("{{nama}}","x".repeat(80)).replaceAll("{{situs}}","Madevi").length<=max;
});
const audience = z.enum(["user","verified","unverified","all"]);
const save = z.discriminatedUnion("action",[
  z.object({action:z.literal("draft"),id:z.uuid(), title:pattern(160), body:pattern(2000), audience, recipientId:z.string().min(1).max(128).optional(), mediaId:z.uuid().optional(), expectedUpdated:z.iso.datetime({offset:true}).optional()}).strict(),
  z.object({action:z.literal("template"),id:z.uuid(), name:z.string().trim().min(1).max(100), title:pattern(160), body:pattern(2000)}).strict(),
  z.object({action:z.literal("removeTemplate"),id:z.uuid()}).strict(),
  z.object({action:z.enum(["queue","send","cancel","retry"]),id:z.uuid(),runAt:z.iso.datetime({offset:true}).optional(),expectedUpdated:z.iso.datetime({offset:true}).optional()}).strict()
]);
const headers={"Cache-Control":"no-store"};

export async function GET(request:Request) {
  if(!await currentAdmin()) return failure("Tidak diizinkan",403);
  const preview=new URL(request.url).searchParams.get("preview");
  if(preview!==null) {
    if(!z.uuid().safeParse(preview).success)return failure("ID pesan tidak valid.",400);
    try {
      const {rows}=await pool.query(`SELECT j.id,j.title,j.body,j.status,j.audience,j.recipient_id,
        j.media_id,m.name AS media_name,date_trunc('milliseconds',j.updated_at) AS updated_at,
        (SELECT count(*)::int FROM "user" u WHERE ${messageAudience}) AS recipients
        FROM madevi_message_jobs j LEFT JOIN madevi_library m ON m.id=j.media_id WHERE j.id=$1`,[preview]);
      return rows[0]?Response.json(rows[0],{headers}):failure("Pesan tidak ditemukan.",404);
    } catch {return failure("Cakupan pengiriman belum dapat dihitung.",503);}
  }
  const parsed=z.coerce.number().int().min(1).max(10000).safeParse(new URL(request.url).searchParams.get("page")??1);
  if(!parsed.success) return failure("Halaman tidak valid",400);
  try {
    const [jobs,templates] = await Promise.all([
      pool.query(`SELECT j.id,j.title,j.body,j.audience,j.recipient_id,j.media_id,j.status,j.run_at,j.sent_at,j.deliveries,j.attempts,j.failure_code,
        date_trunc('milliseconds',j.updated_at) AS updated_at,
        (SELECT count(*)::int FROM madevi_notifications n JOIN madevi_notification_reads r ON r.notification_id=n.id WHERE n.job_id=j.id) AS reads
        FROM madevi_message_jobs j ORDER BY j.updated_at DESC,j.id DESC LIMIT 26 OFFSET $1`,[(parsed.data-1)*25]),
      pool.query("SELECT id,name,title,body FROM madevi_message_templates ORDER BY name,id")
    ]);
    return Response.json({jobs:jobs.rows.slice(0,25),hasNext:jobs.rows.length>25,templates:templates.rows},{headers});
  } catch { return failure("Pesan belum tersedia",503); }
}

async function handlePOST(request:Request) {
  const actor=await currentAdmin();
  if(!actor || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  const parsed=save.safeParse(await bodyJson(request).catch(()=>null));
  if(!parsed.success) return failure("Periksa isi, variabel, tujuan dan lampiran",400);
  const data=parsed.data;
  if(data.action==="draft" && (data.audience==="user")!==Boolean(data.recipientId)) return failure("Pilih satu penerima untuk tujuan akun",400);
  if("runAt" in data&&data.action!=="queue"&&data.runAt)return failure("Jadwal hanya untuk tindakan antrekan",400);
  if(data.action==="queue" && data.runAt && Date.parse(data.runAt)<Date.now()) return failure("Jadwal harus berada di masa depan",400);
  let client;
  try {
    client=await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7412312)");
    let result;
    if(data.action==="template") {
      result=await client.query(`INSERT INTO madevi_message_templates(id,name,title,body)
        SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM madevi_message_templates WHERE id=$1) OR
        (SELECT count(*) FROM madevi_message_templates)<200
        ON CONFLICT(id) DO UPDATE SET name=$2,title=$3,body=$4,updated_at=now()`,[data.id,data.name,data.title,data.body]);
    } else if(data.action==="removeTemplate") {
      result=await client.query("DELETE FROM madevi_message_templates WHERE id=$1",[data.id]);
    } else if(data.action==="draft") {
      result=await client.query(`INSERT INTO madevi_message_jobs(id,author,title,body,audience,recipient_id,media_id)
        SELECT $1,$2,$3,$4,$5,$6,$7 WHERE ($6::text IS NULL OR EXISTS(SELECT 1 FROM "user" u WHERE id=$6 AND NOT ${accountRestricted}))
        AND ($8::text IS NULL OR EXISTS(SELECT 1 FROM madevi_message_jobs WHERE id=$1))
        ON CONFLICT(id) DO UPDATE SET title=$3,body=$4,audience=$5,recipient_id=$6,media_id=$7,updated_at=now()
        WHERE madevi_message_jobs.status='draft' AND date_trunc('milliseconds',madevi_message_jobs.updated_at)=$8::timestamptz`,
        [data.id,actor.row.id,data.title,data.body,data.audience,data.recipientId??null,data.mediaId??null,data.expectedUpdated??null]);
    } else {
      const target=data.action==="cancel"?"cancelled":"scheduled";
      result=await client.query(`UPDATE madevi_message_jobs SET status=$2,run_at=coalesce($3,now()),updated_at=now()
        WHERE id=$1 AND ($4::timestamptz IS NULL OR date_trunc('milliseconds',updated_at)=$4) AND (${data.action==="cancel"?"status IN ('draft','scheduled','failed')":data.action==="retry"?"status='failed' AND attempts<5":"status='draft'"})
        AND ($2='cancelled' OR (SELECT count(*) FROM madevi_message_jobs WHERE status='scheduled')<100)`,[data.id,target,data.runAt??null,data.expectedUpdated??null]);
    }
    if(!result.rowCount) {
      await client.query("ROLLBACK");
      return failure("Tidak dapat diterapkan. Periksa penerima, status, batas, atau muat versi terkini.",409);
    }
    await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)",[actor.row.id,`message.${data.action}`,data.id]);
    await client.query("COMMIT");
    if(data.action==="send") {
      client.release();client=undefined;
      const dispatched=await dispatchMessages(pool,1,data.id).catch(()=>null);
      const persisted=(!dispatched?.delivered&&!dispatched?.failed
        ? await pool.query("SELECT status FROM madevi_message_jobs WHERE id=$1",[data.id]).catch(()=>null):null)?.rows[0]?.status;
      const state=dispatched?.delivered||persisted==="sent"?"sent":dispatched?.failed||persisted==="failed"?"failed":persisted==="cancelled"?"cancelled":"queued";
      return Response.json({ok:true,state},{headers});
    }
    return Response.json({ok:true},{headers});
  } catch(error) {
    await client?.query("ROLLBACK").catch(()=>{});
    return (error as {code?:string}).code==="23503" ? failure("Lampiran atau akun tidak ditemukan",409) : failure("Pesan belum tersimpan",503);
  } finally {client?.release();}
}

export const POST=observeRoute("messages.write",handlePOST);
