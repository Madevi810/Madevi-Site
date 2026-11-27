import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { availabilityInput, defaultAvailability, isAdminAvailable } from "./support-availability";

export class SupportError extends Error {
  constructor(message:string,readonly status=409){super(message);}
}
const body=z.string().trim().min(1).max(4000);
export const userAction=z.discriminatedUnion("action",[
  z.object({action:z.literal("create"),id:z.uuid(),title:z.string().trim().min(1).max(160),body}).strict(),
  z.object({action:z.literal("reply"),id:z.uuid(),postId:z.uuid(),body,version:z.number().int().positive()}).strict(),
]);
export const adminAction=z.discriminatedUnion("action",[
  z.object({action:z.enum(["reply","note"]),id:z.uuid(),postId:z.uuid(),body,version:z.number().int().positive()}).strict(),
  z.object({action:z.enum(["resolve","reopen"]),id:z.uuid(),postId:z.uuid(),version:z.number().int().positive()}).strict(),
]);
export const listInput=z.object({
  id:z.uuid().optional(),page:z.coerce.number().int().min(1).max(10000).default(1),
  before:z.string().regex(/^[1-9][0-9]{0,17}$/).optional(),
  status:z.enum(["waiting_admin","waiting_user","resolved"]).optional()
}).strict().refine(q=>!q.before||Boolean(q.id&&q.page===1));
export type ThreadQuery=z.infer<typeof listInput>;
type ThreadAction=z.infer<typeof userAction>|z.infer<typeof adminAction>;

export async function readAvailability() {
  const stored=(await pool.query("SELECT config,version FROM madevi_support_availability WHERE id=1")).rows[0];
  return {settings:stored?availabilityInput.parse(stored.config):defaultAvailability,version:stored?.version??0};
}

export async function readThreads(query:ThreadQuery,userId?:string) {
  const offset=(query.page-1)*25;
  if(!query.id) {
    const result=await pool.query(`SELECT id,title,status,version,updated_at FROM madevi_support_threads
      WHERE ($1::text IS NULL OR user_id=$1) AND ($2::text IS NULL OR status=$2)
      ORDER BY updated_at DESC,id DESC LIMIT 26 OFFSET $3`,[userId??null,query.status??null,offset]);
    return {items:result.rows.slice(0,25),next:result.rows.length>25};
  }
  const record=(await pool.query(`SELECT id,title,status,version,updated_at FROM madevi_support_threads
    WHERE id=$1 AND ($2::text IS NULL OR user_id=$2)`,[query.id,userId??null])).rows[0];
  if(!record)throw new SupportError("Percakapan tidak ditemukan.",404);
  const result=await pool.query(`SELECT id,sender,body,created_at,event_order::text AS position FROM madevi_support_posts
    WHERE thread_id=$1 AND ($2::boolean OR sender<>'note') AND ($3::bigint IS NULL OR event_order<$3)
    ORDER BY event_order DESC LIMIT 26 OFFSET $4`,[query.id,!userId,query.before??null,offset]);
  const next=result.rows.length>25;
  const before=next?result.rows[24].position:null;
  return {thread:record,posts:result.rows.slice(0,25).reverse().map(({position:_position,...post})=>post),next,before};
}

export async function updateThread(actor:string,input:ThreadAction,isAdmin=false) {
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    if(input.action==="create") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["support:"+actor]);
      const existing=(await client.query(`SELECT t.user_id,t.title,
        (SELECT p.body FROM madevi_support_posts p WHERE p.thread_id=t.id AND p.sender='user' ORDER BY p.event_order LIMIT 1) AS body
        FROM madevi_support_threads t WHERE t.id=$1`,[input.id])).rows[0];
      if(existing) {
        if(existing.user_id!==actor)throw new SupportError("Percakapan tidak ditemukan.",404);
        if(existing.title!==input.title||existing.body!==input.body)throw new SupportError("ID permintaan sudah digunakan untuk isi berbeda.");
        await client.query("COMMIT");return;
      }
      const count=(await client.query("SELECT count(*)::int AS n FROM madevi_support_threads WHERE user_id=$1 AND status<>'resolved'",[actor])).rows[0].n;
      if(count>=5)throw new SupportError("Tunggu penyelesaian percakapan yang sudah terbuka.");
      await client.query("INSERT INTO madevi_support_threads(id,user_id,title) VALUES($1,$2,$3)",[input.id,actor,input.title]);
      await client.query("INSERT INTO madevi_support_posts(id,thread_id,sender,actor_id,body) VALUES($1,$2,'user',$3,$4)",[randomUUID(),input.id,actor,input.body]);
      const rule=(await client.query(`SELECT response FROM madevi_support_rules WHERE enabled AND keyword IS NOT NULL
        AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())
        AND position(lower(keyword) IN lower($1))>0 ORDER BY length(keyword) DESC,id LIMIT 1`,[input.title+" "+input.body])).rows[0];
      const stored=(await client.query("SELECT config FROM madevi_support_availability WHERE id=1")).rows[0];
      const config=stored?availabilityInput.parse(stored.config):defaultAvailability;
      const reply=rule?.response||(!isAdminAvailable(config,new Date())?config.awayReply:"");
      if(reply)await client.query("INSERT INTO madevi_support_posts(id,thread_id,sender,body) VALUES($1,$2,'auto',$3)",[randomUUID(),input.id,reply]);
    } else {
      const record=(await client.query(`SELECT status,version FROM madevi_support_threads
        WHERE id=$1 AND ($2::text IS NULL OR user_id=$2) FOR UPDATE`,[input.id,isAdmin?null:actor])).rows[0];
      if(!record)throw new SupportError("Percakapan tidak ditemukan.",404);
      const sender=input.action==="note"?"note":input.action==="reply"?isAdmin?"admin":"user":"event";
      const text="body" in input?input.body:input.action==="resolve"?"Admin menyelesaikan percakapan.":"Admin membuka kembali percakapan.";
      const existing=(await client.query("SELECT thread_id,actor_id,sender,body FROM madevi_support_posts WHERE id=$1",[input.postId])).rows[0];
      if(existing) {
        if(existing.thread_id!==input.id||existing.actor_id!==actor||existing.sender!==sender||existing.body!==text)throw new SupportError("ID perubahan sudah digunakan.");
        await client.query("COMMIT");return;
      }
      if(record.version!==input.version)throw new SupportError("Percakapan berubah. Muat ulang sebelum meneruskan.");
      if((input.action==="reopen")!==(record.status==="resolved")&&!(isAdmin&&input.action==="note")) {
        throw new SupportError("Tindakan tidak sesuai dengan status percakapan.");
      }
      const used=(await client.query("SELECT count(*)::int AS n FROM madevi_support_posts WHERE thread_id=$1",[input.id])).rows[0].n;
      if(used>=500&&(input.action==="reply"||input.action==="note"))throw new SupportError("Percakapan mencapai batas 500 pesan. Tutup dan buat percakapan baru.");
      const status=input.action==="resolve"?"resolved":input.action==="reopen"||!isAdmin?"waiting_admin":input.action==="reply"?"waiting_user":record.status;
      await client.query("INSERT INTO madevi_support_posts(id,thread_id,sender,actor_id,body) VALUES($1,$2,$3,$4,$5)",[input.postId,input.id,sender,actor,text]);
      await client.query("UPDATE madevi_support_threads SET status=$2,version=version+1,updated_at=now() WHERE id=$1",[input.id,status]);
      if(isAdmin)await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)",[actor,`support.${input.action}`,input.id]);
    }
    await client.query("COMMIT");
  } catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
