import { apiRoute } from "@/lib/api-response";
import { getSessionCookie } from "better-auth/cookies";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-config";
import { recordSecurityEvent } from "@/lib/security-log";
import { currentAuthenticationAccount, hasAdministrativeMfa } from "@/lib/access";
import { bodyJson, sameOrigin } from "@/lib/api";
import { isPrivileged } from "@/lib/auth-policy";
import { smtpSettings } from "@/lib/env";
import { emailChangeSeconds, sessionUsable } from "@/lib/session-policy";
import { pool } from "@/lib/db";
import { z } from "zod";
import type { PoolClient } from "pg";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
const getPaths=new Set(["/get-session","/callback/google","/verify-email","/error"]);
const openPosts=new Set(["/sign-out","/sign-in/email","/sign-in/username","/sign-in/social",
  "/two-factor/verify-totp","/two-factor/verify-backup-code","/email-otp/request-password-reset","/email-otp/reset-password"]);
const privatePosts=new Set(["/update-user","/change-password","/two-factor/enable","/two-factor/generate-backup-codes",
  "/email-otp/request-email-change","/email-otp/change-email"]);
const limitedInputs=new Set([...privatePosts,...[...openPosts].filter(path=>path!=="/sign-out")]);
const headers={"Cache-Control":"private, no-store"};
type Account=NonNullable<Awaited<ReturnType<typeof currentAuthenticationAccount>>>;

const email=z.email().max(254).transform(value=>value.toLowerCase());
const password=z.string().min(1).max(128);
const newPassword=z.string().min(10).max(128);
const otp=z.string().regex(/^\d{6}$/);

function reject(message:string,status:number) {
  return Response.json({error:message},{status,headers});
}

function endpoint(request:Request) {
  return new URL(request.url).pathname.replace(/\/+$/, "").slice("/api/auth".length);
}

function withBody(request:Request,body:unknown) {
  const nextHeaders=new Headers(request.headers);
  nextHeaders.delete("content-length");
  return new Request(request.url,{method:"POST",headers:nextHeaders,body:JSON.stringify(body)});
}

async function withoutSessionSecrets(response:Response) {
  if(!response.ok||!response.headers.get("Content-Type")?.startsWith("application/json"))return response;
  const data=await response.clone().json().catch(()=>null);
  if(!data||typeof data!=="object")return response;
  delete data.token;
  if(data.session&&typeof data.session==="object") {
    delete data.session.token;
    delete data.session.ipAddress;
    delete data.session.userAgent;
  }
  const safeHeaders=new Headers(response.headers);
  safeHeaders.delete("Content-Length");
  safeHeaders.set("Cache-Control","private, no-store");
  return Response.json(data,{status:response.status,headers:safeHeaders});
}

async function handleGET(request:Request) {
  const path=endpoint(request);
  if(!getPaths.has(path))return reject("Jalur autentikasi tidak tersedia.",403);
  if(path==="/get-session"&&getSessionCookie(request)&&!await currentAuthenticationAccount()) {
    return Response.json(null,{headers});
  }
  const response=await handlers.GET(request);
  return path==="/get-session"?withoutSessionSecrets(response):response;
}

async function handlePOST(request:Request) {
  const path=endpoint(request);
  if(!sameOrigin(request))return reject("Permintaan tidak valid.",403);
  if(!openPosts.has(path)&&!privatePosts.has(path))return reject("Jalur autentikasi tidak tersedia.",403);
  if(path==="/sign-out")return handlers.POST(request);

  if(limitedInputs.has(path)&&!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||"")) {
    return reject("Gunakan data JSON.",415);
  }
  const body=await bodyJson(request.clone()).catch(()=>null);
  if(!body)return reject("Data autentikasi tidak valid.",400);
  if(path.startsWith("/email-otp/")&&!smtpSettings())return reject("Layanan email belum dikonfigurasi.",503);

  const factorProof=path==="/two-factor/verify-totp"||path==="/two-factor/verify-backup-code";
  if(path.startsWith("/sign-in/"))return recordedAuthentication(request,path);
  const account=getSessionCookie(request)?await currentAuthenticationAccount():null;
  if(factorProof&&!account) {
    // Better Auth proves the password challenge through its signed 2FA cookie.
    if(getSessionCookie(request)&&await auth.api.getSession({
      headers:request.headers,query:{disableRefresh:true,disableCookieCache:true},
    }))return reject("Sesi telah berakhir. Masuk kembali.",401);
    return recordedAuthentication(request,path);
  }
  if(path==="/email-otp/request-password-reset"||path==="/email-otp/reset-password") {
    const input=z.object({email}).safeParse(body);
    if(!input.success)return reject("Data autentikasi tidak valid.",400);
    const {rows}=await pool.query('SELECT "madeviRole" FROM "user" WHERE email=$1',[input.data.email]);
    if(rows[0]&&isPrivileged(rows[0].madeviRole)) {
      return path==="/email-otp/request-password-reset"?Response.json({success:true},{headers}):reject("Kode atau permintaan pemulihan tidak valid.",400);
    }
    return handlers.POST(request);
  }

  if(!account)return reject("Sesi tidak aktif. Masuk kembali.",401);
  const privileged=isPrivileged(account.row.madeviRole);
  const enrollment=path==="/two-factor/enable"||path==="/two-factor/verify-totp";
  if(privileged&&!hasAdministrativeMfa(account.row)&&!(enrollment&&account.row.madeviRole==="admin"&&!account.row.twoFactorEnabled)) {
    return reject("Masuk kembali dengan kata sandi dan autentikator.",403);
  }
  if(path==="/update-user")return updateName(account,body);
  if(factorProof) {
    if(path==="/two-factor/verify-totp"&&!account.row.twoFactorEnabled) {
      return serialSecurity(account,async()=>{
        const response=await recordedAuthentication(request,path);
        if(response.ok)await pool.query(`INSERT INTO madevi_audit(actor_id,action,target_id)
          VALUES($1,'account.mfa.enrollment_verified',$1)`,[account.row.id]);
        return response;
      });
    }
    return recordedAuthentication(request,path);
  }
  if(privileged&&account.row.twoFactorEnabled&&!account.row.recentMfa) {
    return reject("Untuk tindakan ini, masuk ulang dengan autentikator lalu lanjutkan dalam lima menit.",403);
  }

  return serialSecurity(account,async client=>{
    if(path==="/change-password") {
      const input=z.object({currentPassword:password,newPassword,revokeOtherSessions:z.boolean().optional()}).strict().safeParse(body);
      if(!input.success||privileged&&input.data.newPassword.length<12)return reject("Periksa kata sandi lama dan baru.",400);
      // The database revokes all sessions in the same transaction as the password write.
      return handlers.POST(withBody(request,{...input.data,revokeOtherSessions:false}));
    }
    if(path==="/email-otp/request-email-change") {
      const input=z.object({newEmail:email,password}).strict().safeParse(body);
      if(!input.success)return reject("Email baru dan kata sandi diperlukan.",400);
      try {
        const proof=await auth.api.verifyPassword({headers:request.headers,body:{password:input.data.password}});
        if(!proof.status)return reject("Identitas belum terkonfirmasi.",403);
      } catch(error) {
        if(error instanceof Error&&"statusCode" in error&&[400,401,403].includes(Number(error.statusCode))) {
          return reject("Identitas belum terkonfirmasi.",403);
        }
        throw error;
      }
      await client.query("DELETE FROM madevi_email_change_proof WHERE user_id=$1",[account.row.id]);
      const response=await handlers.POST(withBody(request,{newEmail:input.data.newEmail}));
      if(response.ok)await client.query(`INSERT INTO madevi_email_change_proof(user_id,session_id,target,expires_at)
        SELECT $1,s.id,$3,now()+make_interval(secs=>$4) FROM "session" s JOIN "user" u ON u.id=s."userId"
        WHERE s.id=$2 AND u.id=$1 AND ${sessionUsable}`,[account.row.id,account.session.session.id,input.data.newEmail,emailChangeSeconds]);
      return response;
    }
    if(path==="/email-otp/change-email") {
      const input=z.object({newEmail:email,otp}).strict().safeParse(body);
      if(!input.success)return reject("Email dan kode tidak valid.",400);
      const proof=await client.query(`SELECT 1 FROM madevi_email_change_proof
        WHERE user_id=$1 AND session_id=$2 AND target=$3 AND expires_at>now()`,
        [account.row.id,account.session.session.id,input.data.newEmail]);
      if(!proof.rowCount)return reject("Verifikasi email perlu dimulai kembali pada sesi ini.",403);
      return handlers.POST(withBody(request,input.data));
    }
    if(path==="/two-factor/enable") {
      const input=z.object({password,method:z.literal("totp").default("totp")}).strict().safeParse(body);
      if(!input.success)return reject("Gunakan autentikator TOTP.",400);
      return recordedAuthentication(withBody(request,input.data),path);
    }
    if(path==="/two-factor/generate-backup-codes") {
      const input=z.object({password}).strict().safeParse(body);
      if(!input.success)return reject("Kata sandi diperlukan.",400);
      const response=await recordedAuthentication(withBody(request,input.data),path);
      if(response.ok)await client.query(`WITH revoked AS (
        DELETE FROM "session" WHERE "userId"=$1 AND id<>$2
      ) INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,'account.mfa.backup_codes_changed',$1)`,
      [account.row.id,account.session.session.id]);
      return response;
    }
    return reject("Jalur autentikasi tidak tersedia.",403);
  });
}

let securityWrites=0;

async function serialSecurity(account:Account, action:(client:PoolClient)=>Promise<Response>) {
  if(securityWrites>=2)return reject("Perubahan keamanan sedang sibuk. Coba sesaat lagi.",503);
  securityWrites++;
  let client:PoolClient|undefined;
  const key=`account-security:${account.row.id}`;
  let locked=false;
  try {
    client=await pool.connect();
    locked=(await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",[key])).rows[0].locked;
    if(!locked)return reject("Perubahan keamanan akun sedang diproses.",409);
    const fresh=await currentAuthenticationAccount();
    if(!fresh||fresh.session.session.id!==account.session.session.id)return reject("Sesi tidak aktif. Masuk kembali.",401);
    return await action(client);
  } finally {
    let discard=false;
    if(locked&&client)await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))",[key]).catch(()=>{discard=true;});
    client?.release(discard);
    securityWrites--;
  }
}

async function recordedAuthentication(request:Request,path:string) {
  const response=await handlers.POST(request);
  await recordSecurityEvent("auth.attempt",{outcome:response.ok?"response_ok":"rejected",action:path.startsWith("/two-factor/")?"two-factor":"sign-in",status:response.status});
  return withoutSessionSecrets(response);
}

async function updateName(account:Account,body:unknown) {
  const input=z.object({name:z.string().trim().min(2).max(100)}).strict().safeParse(body);
  if(!input.success)return reject("Gunakan pengaturan profil MADEVI.",400);
  await pool.query(`WITH changed AS (
    UPDATE "user" SET name=$1,"updatedAt"=now() WHERE id=$2 RETURNING id
  ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT id,'account.name.update',id FROM changed`,
    [input.data.name,account.row.id]);
  return Response.json({status:true},{headers});
}

export const GET=apiRoute("/api/auth/[...all]","GET",handleGET,true);
export const POST=apiRoute("/api/auth/[...all]","POST",handlePOST,true);
