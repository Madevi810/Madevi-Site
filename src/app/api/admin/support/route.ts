import { z } from "zod";
import { randomUUID } from "node:crypto";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";

const rule=z.object({
  id:z.uuid().optional(),keyword:z.string().trim().max(100),response:z.string().trim().min(1).max(2000),
  startsAt:z.iso.datetime().nullable(),endsAt:z.iso.datetime().nullable(),enabled:z.boolean(),
}).strict().refine(v=>!v.startsAt||!v.endsAt||Date.parse(v.startsAt)<Date.parse(v.endsAt));
export async function GET() {
  if(!await currentAdmin())return failure("Tidak diizinkan",403);
  try {return Response.json({rules:(await pool.query("SELECT * FROM madevi_support_rules ORDER BY keyword NULLS LAST,id LIMIT 100")).rows},{headers:{"Cache-Control":"no-store"}});}
  catch{return failure("Aturan belum tersedia",503);}
}
export async function PUT(request:Request) {
  const admin=await currentAdmin();
  if(!admin||!sameOrigin(request))return failure("Tidak diizinkan",403);
  const input=rule.safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("Periksa kata kunci, jawaban, dan waktu",400);
  const v=input.data;
  let client;
  try {
    client=await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7412310)");
    if(!v.id && Number((await client.query("SELECT count(*)::int AS n FROM madevi_support_rules")).rows[0].n)>=100) {
      await client.query("ROLLBACK");return failure("Batas 100 aturan tercapai. Ubah aturan yang ada.",409);
    }
    const id=v.id??randomUUID();
    await client.query(`WITH changed AS (
      INSERT INTO madevi_support_rules(id,keyword,response,enabled,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET keyword=$2,response=$3,enabled=$4,starts_at=$5,ends_at=$6 RETURNING id
    ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $7,'support.rule.update',id::text FROM changed`,
      [id,v.keyword.toLowerCase()||null,v.response,v.enabled,v.startsAt,v.endsAt,admin.row.id]);
    await client.query("COMMIT");
    return Response.json({ok:true,id});
  } catch {await client?.query("ROLLBACK").catch(()=>{});return failure("Aturan belum tersimpan",503);}
  finally {client?.release();}
}
