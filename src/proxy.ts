import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth-config";
import { allowApiRequest } from "@/lib/rate-limit";
import { browserRateId, issueRateCookie, rateCookie, rateCookieAge, trustedClientIp } from "@/lib/rate-identity";
import { apiError, logApiFailure } from "@/lib/api-response";
import { securityLog } from "@/lib/security-log";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "");
  const cookie = request.cookies.get(rateCookie)?.value;
  const health = path.startsWith("/api/health/");
  if (path.startsWith("/api/") && !health) {
    try {
      const session = getSessionCookie(request) && await auth.api.getSession({
        headers: request.headers, query: { disableRefresh: true, disableCookieCache: true },
      });
      if (!await allowApiRequest(request, path, cookie, session ? session.user.id : undefined)) {
        securityLog("rate.limited", { outcome: "denied", action: path.startsWith("/api/auth/") ? "auth" : "api", status: 429 });
        const id = crypto.randomUUID();
        if (path.startsWith("/api/auth/")) return NextResponse.json({code: "RATE_LIMITED", message: "Terlalu banyak permintaan."}, {
          status: 429, headers: {"Retry-After": "60", "Cache-Control": "no-store", "x-request-id": id},
        });
        return apiError(429, id);
      }
    } catch {
      const id = crypto.randomUUID();
      logApiFailure("proxy.api", request.method, id, 503);
      if (path.startsWith("/api/auth/")) return NextResponse.json({code: "UNAVAILABLE", message: "Layanan sementara tidak tersedia."}, {
        status: 503, headers: {"Cache-Control": "no-store", "x-request-id": id},
      });
      return apiError(503, id);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${dev ? "" : "; upgrade-insecure-requests"}`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (process.env.MADEVI_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (!health && !browserRateId(cookie) && !trustedClientIp(request.headers)) {
    response.cookies.set(rateCookie, issueRateCookie(), {
      httpOnly: true, secure: process.env.BETTER_AUTH_URL?.startsWith("https:"),
      sameSite: "lax", path: "/", maxAge: rateCookieAge,
    });
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
