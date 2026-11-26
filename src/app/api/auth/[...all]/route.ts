import { getSessionCookie } from "better-auth/cookies";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-config";
import { recordSecurityEvent } from "@/lib/security-log";
import { currentAccount, currentAuthenticationAccount, hasAdministrativeMfa } from "@/lib/access";
import { bodyJson, sameOrigin } from "@/lib/api";
import { isPrivileged } from "@/lib/auth-policy";
import { smtpSettings } from "@/lib/env";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
const enrollmentActions = new Set(["/api/auth/two-factor/enable", "/api/auth/two-factor/verify-totp"]);
const emailActions = new Set([
  "/api/auth/email-otp/request-password-reset", "/api/auth/email-otp/reset-password",
  "/api/auth/email-otp/request-email-change", "/api/auth/email-otp/change-email",
]);
async function privilegedGuard(request: Request, path: string) {
  if (!getSessionCookie(request) || path.startsWith("/api/auth/callback/") ||
      path.startsWith("/api/auth/sign-in/") || path === "/api/auth/sign-out" || path === "/api/auth/get-session") return;
  const account = await currentAuthenticationAccount();
  if (!account || !isPrivileged(account.row.madeviRole)) return;
  if (path === "/api/auth/link-social" || (path === "/api/auth/two-factor/disable" && !account.row.isDemo)) {
    return Response.json({ error: "Jalur ini tidak tersedia untuk akun pengelola." }, { status: 403 });
  }
  if (hasAdministrativeMfa(account.row)) return;
  if (account.row.madeviRole === "admin" && !account.row.twoFactorEnabled && enrollmentActions.has(path)) return;
  return Response.json({ error: "Masuk kembali dengan kata sandi dan autentikator." }, { status: 403 });
}

export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (path.startsWith("/api/auth/reset-password/")) return Response.json({ error: "Gunakan OTP email." }, { status: 403 });
  try { return await privilegedGuard(request, path) || await handlers.GET(request); }
  catch { return Response.json({ error: "Autentikasi sementara tidak tersedia." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const requestedPath=new URL(request.url).pathname.replace(/\/+$/, "");
  if (!requestedPath.startsWith("/api/auth/callback/") && !sameOrigin(request)) {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  if (emailActions.has(requestedPath) || /^\/api\/auth\/sign-in\/(email|username)$/.test(requestedPath)) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
      return Response.json({ error: "Gunakan data JSON." }, { status: 415 });
    }
    try { await bodyJson(request.clone()); }
    catch { return Response.json({ error: "Data autentikasi tidak valid." }, { status: 400 }); }
  }
  if (emailActions.has(requestedPath) && !smtpSettings()) {
    return Response.json({ error: "Layanan email belum dikonfigurasi." }, { status: 503 });
  }
  try {
    const denied = await privilegedGuard(request, requestedPath);
    if (denied) return denied;
  } catch {
    return Response.json({ error: "Autentikasi sementara tidak tersedia." }, { status: 503 });
  }
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
  let response;
  try {
    response = await handlers.POST(request);
  } catch {
    return Response.json({ error: "Autentikasi sementara tidak tersedia." }, { status: 503 });
  }
  const path=new URL(request.url).pathname;
  if(/\/sign-in\//.test(path)||path.includes("/two-factor/"))await recordSecurityEvent("auth.attempt",{outcome:response.ok?"response_ok":"rejected",action:path.includes("two-factor")?"two-factor":"sign-in",status:response.status});
  return response;
}

