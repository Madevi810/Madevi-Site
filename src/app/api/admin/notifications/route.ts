import { apiRoute } from "@/lib/api-response";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentPrincipal } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { accountRestricted } from "@/lib/account-status";
import { pool } from "@/lib/db";

const input=z.object({id:z.uuid().optional(),audience:z.enum(["general","system"]),recipientId:z.string().max(128).optional(),
  title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).max(2000)
}).strict().refine(v=>v.audience==="general"?!v.recipientId:Boolean(v.recipientId));

async function handlePOST(request:Request) {
  const actor=await currentPrincipal("accounts.manage");
  if(!actor||!sameOrigin(request))return failure("Tidak diizinkan.",403);
  const parsed=input.safeParse(await bodyJson(request).catch(()=>null));
  if(!parsed.success)return failure("Periksa data pemberitahuan.",400);
  const data=parsed.data,id=data.id??randomUUID(),recipient=data.recipientId??null;
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialise requests using the same client ID, including replays after a lost response.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`notification:${id}`]);
    const existing=(await client.query("SELECT category,recipient_id,title,body,created_by FROM madevi_notifications WHERE id=$1",[id])).rows[0];
    if(existing) {
      await client.query("ROLLBACK");
      if(existing.created_by!==actor.row.id||existing.category!==data.audience||existing.recipient_id!==recipient||existing.title!==data.title||existing.body!==data.body) {
        return failure("ID pengumuman sudah digunakan untuk data berbeda.",409);
      }
      return Response.json({ok:true,id});
    }
    if(recipient) {
      const user=await client.query(`SELECT 1 FROM "user" u WHERE id=$1 AND NOT ${accountRestricted}`,[recipient]);
      if(!user.rowCount){await client.query("ROLLBACK");return failure("Akun tidak tersedia.",404);}
    }
    await client.query("INSERT INTO madevi_notifications(id,category,recipient_id,title,body,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [id,data.audience,recipient,data.title,data.body,actor.row.id]);
    await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)",[actor.row.id,"notification.create",id]);
    await client.query("COMMIT");
    return Response.json({ok:true,id},{status:201});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
  } finally {client.release();}
}

export const POST=apiRoute("/api/admin/notifications","POST",handlePOST);
