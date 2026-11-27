import { apiRoute } from "@/lib/api-response";
import { currentAccount } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { sessionUsable } from "@/lib/session-policy";

export const POST = apiRoute("/api/account/activity", "POST", async (request:Request) => {
  if(!sameOrigin(request))return failure("Permintaan tidak diizinkan.",403);
  const account=await currentAccount();
  if(!account)return failure("Sesi tidak aktif. Masuk kembali.",401);
  await pool.query(`UPDATE "session" s SET "madeviActiveAt"=now() FROM "user" u
    WHERE s.id=$1 AND s."userId"=u.id AND u.id=$2 AND ${sessionUsable}
      AND coalesce(s."madeviActiveAt",s."createdAt")<=now()-interval '1 minute'`,
    [account.session.session.id,account.row.id]);
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
});
