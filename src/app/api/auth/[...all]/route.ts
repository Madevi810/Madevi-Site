import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-config";
import { recordSecurityEvent } from "@/lib/security-log";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
export async function GET(request:Request){const path=new URL(request.url).pathname;if(path.startsWith("/api/auth/reset-password/"))return Response.json({error:"Gunakan OTP email."},{status:403});return handlers.GET(request)}
export async function POST(request: Request) {
  const requestedPath=new URL(request.url).pathname.replace(/\/+$/, "");
  if(["/api/auth/request-password-reset","/api/auth/reset-password","/api/auth/change-password","/api/auth/set-password","/api/auth/forget-password/email-otp","/api/auth/sign-in/email-otp"].includes(requestedPath)||(requestedPath.startsWith("/api/auth/email-otp/")&&!['/api/auth/email-otp/request-password-reset','/api/auth/email-otp/reset-password','/api/auth/email-otp/request-email-change','/api/auth/email-otp/change-email'].includes(requestedPath)))return Response.json({error:"Gunakan pemulihan kata sandi dengan OTP email."},{status:403});
  if (requestedPath.endsWith("/sign-up/email")) return Response.json({ error: "Gunakan pendaftaran MADEVI" }, { status: 403 });
  const response=await handlers.POST(request);
  const path=new URL(request.url).pathname;
  if(/\/sign-in\//.test(path)||path.includes("/two-factor/"))await recordSecurityEvent("auth.attempt",{outcome:response.ok?"response_ok":"rejected",action:path.includes("two-factor")?"two-factor":"sign-in",status:response.status});
  return response;
}

