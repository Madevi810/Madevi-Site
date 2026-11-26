import { z } from "zod";
import { currentPrincipal } from "@/lib/access";
import { pool } from "@/lib/db";
import { accountStatus } from "@/lib/account-status";
import { bodyJson, sameOrigin } from "@/lib/api";
import { parseAdminUsersQuery } from "@/lib/admin-users-query";

const bad=(error:string,status:number)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  if (!await currentPrincipal("accounts.manage")) return bad("Tidak diizinkan",403);
  const url=new URL(request.url);
  const id=url.searchParams.get("id");
  if (id) {
    if(id.length>128) return bad("ID tidak valid",400);
    try {
      const {rows}=await pool.query(`SELECT u.id,u.name,u.email,u.username,u."emailVerified",u."createdAt",u.restricted_until,
        ${accountStatus} AS status,u."madeviRole" AS role,
        (SELECT count(*)::int FROM "session" s WHERE s."userId"=u.id AND s."expiresAt">now()) AS sessions
        FROM "user" u WHERE u.id=$1`,[id]);
      if(!rows[0]) return bad("Akun tidak ditemukan",404);
      const history=await pool.query("SELECT action,reason,outcome,actor_id,created_at FROM madevi_audit WHERE target_id=$1 AND action IN ('block','restore','suspend','ban','revoke') ORDER BY created_at DESC,id DESC LIMIT 30",[id]);
      return Response.json({account:rows[0],history:history.rows},{headers:{"Cache-Control":"no-store"}});
    } catch {return bad("Detail akun belum tersedia",503);}
  }
  const parsed=parseAdminUsersQuery(request.url);
  if(!parsed.success) return bad("Parameter tidak valid",400);
  const {page,limit,q,status}=parsed.data;
  try {
    const {rows}=await pool.query(`SELECT u.id,u.name,u.email,u.username,u."emailVerified",u.suspended,u."createdAt",
      u."madeviRole" AS role,${accountStatus} AS status
      FROM "user" u WHERE ($1='' OR position(lower($1) in lower(u.name))>0 OR position(lower($1) in lower(u.email))>0 OR position(lower($1) in lower(coalesce(u.username,'')))>0)
      AND ($4::text IS NULL OR ${accountStatus}=$4)
      ORDER BY u."createdAt" DESC,u.id DESC LIMIT $2 OFFSET $3`,[q,limit+1,(page-1)*limit,status??null]);
    return Response.json({users:rows.slice(0,limit),pagination:{page,limit,hasNext:rows.length>limit}},{headers:{"Cache-Control":"no-store"}});
  } catch {return bad("Data pengguna belum tersedia",503);}
}

const actionInput=z.object({
  id:z.string().min(1).max(128),action:z.enum(["block","restore","suspend","ban","revoke"]),
  reason:z.string().trim().min(3).max(500),until:z.iso.datetime({offset:true}).optional()
}).strict().refine(v=>v.action==="suspend" ? Boolean(v.until && Date.parse(v.until)>Date.now()) : !v.until);
export async function POST(request:Request) {
  const admin=await currentPrincipal("accounts.manage");
  if(!admin || !sameOrigin(request)) return bad("Tidak diizinkan",403);
  const parsed=actionInput.safeParse(await bodyJson(request).catch(()=>null));
  if(!parsed.success || parsed.data.id===admin.row.id) return bad("Periksa alasan, tindakan dan waktu suspend",400);
  const {id,action,reason,until}=parsed.data;
  const states={block:"blocked",restore:null,suspend:"suspended",ban:"banned",revoke:null};
  let client;
  try {
    client=await pool.connect();
    await client.query("BEGIN");
    const target=await client.query("SELECT id FROM \"user\" WHERE id=$1 AND \"madeviRole\"='user' FOR UPDATE",[id]);
    if(!target.rowCount) {
      await client.query("INSERT INTO madevi_audit(actor_id,action,target_id,reason,outcome) VALUES($1,$2,$3,$4,'failed')",[admin.row.id,action,id,reason]);
      await client.query("COMMIT");
      return bad("Akun tidak ditemukan atau dilindungi",404);
    }
    if(action!=="revoke") await client.query('UPDATE "user" SET restriction=$2,restricted_until=$3,suspended=$4,"updatedAt"=now() WHERE id=$1',[id,states[action],until??null,action==="block"||action==="ban"]);
    if(action!=="restore") await client.query('DELETE FROM "session" WHERE "userId"=$1',[id]);
    await client.query("INSERT INTO madevi_audit(actor_id,action,target_id,reason) VALUES($1,$2,$3,$4)",[admin.row.id,action,id,reason]);
    await client.query("COMMIT");
    return Response.json({ok:true});
  } catch {
    await client?.query("ROLLBACK").catch(()=>{});
    return bad("Perubahan akun belum tersimpan",503);
  } finally {client?.release();}
}
