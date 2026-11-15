import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-config";
import { recordSecurityEvent } from "@/lib/security-log";
import { currentAccount } from "@/lib/access";
import { bodyJson, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
export async function GET(request:Request){const path=new URL(request.url).pathname;if(path.startsWith("/api/auth/reset-password/"))return Response.json({error:"Gunakan OTP email."},{status:403});return handlers.GET(request)}
export async function POST(request: Request) {
  const requestedPath=new URL(request.url).pathname.replace(/\/+$/, "");
  // Keep Better Auth's public update endpoint compatible with the admin name
  // form, without bypassing Madevi's validated profile and private media APIs.
  if (requestedPath === "/api/auth/update-user") {
    if (!sameOrigin(request)) return Response.json({error:"Permintaan tidak valid."},{status:403});
    const input=z.object({name:z.string().trim().min(2).max(100)}).strict().safeParse(await bodyJson(request).catch(()=>null));
    if (!input.success) return Response.json({error:"Gunakan pengaturan profil MADEVI."},{status:400});
    let client;
    try {
      const account=await currentAccount();
      if (!account) return Response.json({error:"Tidak diizinkan"},{status:401});
      client=await pool.connect();
      await client.query("BEGIN");
      await client.query('UPDATE "user" SET name=$1,"updatedAt"=now() WHERE id=$2',[input.data.name,account.row.id]);
      await client.query('INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$1)',[account.row.id,"account.name.update"]);
      await client.query("COMMIT");
      return Response.json({status:true},{headers:{"Cache-Control":"no-store"}});
    } catch {
      if (client) await client.query("ROLLBACK").catch(()=>{});
      return Response.json({error:"Nama belum tersimpan."},{status:503});
    } finally {client?.release();}
  }
  if(["/api/auth/request-password-reset","/api/auth/reset-password","/api/auth/change-password","/api/auth/set-password","/api/auth/forget-password/email-otp","/api/auth/sign-in/email-otp"].includes(requestedPath)||(requestedPath.startsWith("/api/auth/email-otp/")&&!['/api/auth/email-otp/request-password-reset','/api/auth/email-otp/reset-password','/api/auth/email-otp/request-email-change','/api/auth/email-otp/change-email'].includes(requestedPath)))return Response.json({error:"Gunakan pemulihan kata sandi dengan OTP email."},{status:403});
  if (requestedPath.endsWith("/sign-up/email")) return Response.json({ error: "Gunakan pendaftaran MADEVI" }, { status: 403 });
  const response=await handlers.POST(request);
  const path=new URL(request.url).pathname;
  if(/\/sign-in\//.test(path)||path.includes("/two-factor/"))await recordSecurityEvent("auth.attempt",{outcome:response.ok?"response_ok":"rejected",action:path.includes("two-factor")?"two-factor":"sign-in",status:response.status});
  return response;
}

