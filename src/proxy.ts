import { NextRequest, NextResponse } from "next/server";
import { clientKey,consumeRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security-log";
export async function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path.startsWith("/api/")&&!path.startsWith("/api/health/")){
    try{const key=clientKey(request.headers);const strict=path==="/api/register"||/^\/api\/auth\/(sign-in|request-password-reset|two-factor|email-otp)/.test(path);const r=await consumeRateLimit(`${strict?"auth":"api"}:${key}`,strict?15:180,60);if(!r.allowed){securityLog("rate.limited",{outcome:"denied",action:strict?"auth":"api",status:429});return NextResponse.json({error:{message:"Terlalu banyak permintaan"}},{status:429,headers:{"Retry-After":"60","Cache-Control":"no-store"}})}}catch{return NextResponse.json({error:{message:"Layanan sementara tidak tersedia"}},{status:503,headers:{"Cache-Control":"no-store"}})}
  }
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64");const dev=process.env.NODE_ENV!=="production";
  const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${dev?"":"; upgrade-insecure-requests"}`;
  const h=new Headers(request.headers);h.set("x-nonce",nonce);h.set("Content-Security-Policy",csp);const response=NextResponse.next({request:{headers:h}});response.headers.set("Content-Security-Policy",csp);
  if(process.env.MADEVI_ENV==="production")response.headers.set("Strict-Transport-Security","max-age=31536000");
  return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
