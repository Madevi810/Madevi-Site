import { z } from "zod";
import { apiRoute } from "@/lib/api-response";
import { currentAccount } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { sessionUsable } from "@/lib/session-policy";

export const GET = apiRoute("/api/account/sessions", "GET", async () => {
  const account=await currentAccount();
  if(!account)return failure("Masuk kembali untuk melihat sesi.",401);
  const {rows}=await pool.query(`SELECT s.id, s."createdAt" AS "createdAt",
    coalesce(s."madeviActiveAt",s."createdAt") AS "activeAt", s."expiresAt" AS "expiresAt", (s.id=$2) AS current
    FROM "session" s JOIN "user" u ON u.id=s."userId"
    WHERE u.id=$1 AND ${sessionUsable} ORDER BY (s.id=$2) DESC,s."createdAt" DESC LIMIT 50`,
    [account.row.id,account.session.session.id]);
  return Response.json({items:rows},{headers:{"Cache-Control":"private, no-store"}});
});

export const POST = apiRoute("/api/account/sessions", "POST", async (request:Request) => {
  if(!sameOrigin(request))return failure("Permintaan tidak diizinkan.",403);
  const account=await currentAccount();
  if(!account)return failure("Masuk kembali untuk mengelola sesi.",401);
  const input=z.object({id:z.string().min(1).max(128)}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("ID sesi tidak valid.",400);
  if(input.data.id===account.session.session.id)return failure("Untuk sesi ini, gunakan Keluar.",409);
  const result=await pool.query(`WITH revoked AS (
    DELETE FROM "session" WHERE id=$1 AND "userId"=$2 RETURNING 1
  ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $2,'account.session.revoked',$2 FROM revoked`,
    [input.data.id,account.row.id]);
  return result.rowCount?Response.json({ok:true},{headers:{"Cache-Control":"private, no-store"}}):failure("Sesi tidak ditemukan.",404);
});
