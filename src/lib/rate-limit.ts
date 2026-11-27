import { pool } from "./db";
import { rateHash, requestRateIdentity } from "./rate-identity";
import { bodyJson } from "./api";

export async function consumeRateLimit(key: string, limit: number, windowSeconds = 60): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO madevi_rate_limits (key,window_start,hits) VALUES ($1,now(),1)
     ON CONFLICT(key) DO UPDATE SET
       hits=CASE WHEN madevi_rate_limits.window_start <= now()-($2::int * interval '1 second')
         THEN 1 ELSE least(madevi_rate_limits.hits + 1, $3::int + 1) END,
       window_start=CASE WHEN madevi_rate_limits.window_start <= now()-($2::int * interval '1 second')
         THEN now() ELSE madevi_rate_limits.window_start END
     RETURNING hits`,
    [key, windowSeconds, limit],
  );
  return Number(result.rows[0].hits) <= limit;
}

type Group = "api" | "login" | "recovery" | "mfa" | "registration" | "report" | "oauth" | "upload" | "backup-download" | "operations";

function operation(path: string): Group {
  if (path === "/api/register") return "registration";
  if (path === "/api/report") return "report";
  if (/^\/api\/auth\/sign-in\/(email|username)$/.test(path)) return "login";
  if (path.startsWith("/api/auth/two-factor/")) return "mfa";
  if (path.startsWith("/api/auth/email-otp/") || /\/api\/auth\/.*password/.test(path)) return "recovery";
  if (path.startsWith("/api/auth/callback/") || path === "/api/auth/sign-in/social" || path === "/api/auth/link-social") return "oauth";
  return "api";
}

const limits: Record<Group, { ip: number; browser: number; anonymous: number }> = {
  api: { ip: 240, browser: 180, anonymous: 600 },
  login: { ip: 40, browser: 20, anonymous: 20 },
  recovery: { ip: 24, browser: 12, anonymous: 20 },
  mfa: { ip: 40, browser: 20, anonymous: 30 },
  registration: { ip: 18, browser: 6, anonymous: 15 },
  report: { ip: 30, browser: 12, anonymous: 30 },
  oauth: { ip: 40, browser: 20, anonymous: 30 },
  upload: { ip: 24, browser: 12, anonymous: 12 },
  "backup-download": { ip: 8, browser: 4, anonymous: 4 },
  operations: { ip: 20, browser: 12, anonymous: 12 },
};

async function knownTarget(request: Request, path: string): Promise<string | undefined> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return;
  const body = await bodyJson(request.clone()).catch(() => null) as Record<string, unknown> | null;
  const isUsername = path === "/api/auth/sign-in/username";
  const input = isUsername ? body?.username : body?.email;
  if (typeof input !== "string" || input.length > 254) return;
  const normalized = input.trim().normalize("NFC").toLowerCase();
  if (!normalized) return;
  const result = await pool.query<{ id: string }>(
    isUsername ? 'SELECT id FROM "user" WHERE username=$1' : 'SELECT id FROM "user" WHERE email=$1',
    [normalized],
  );
  const id = result.rows[0]?.id;
  return id ? rateHash(`account:${id}`) : rateHash(`unmatched:${isUsername ? "username" : "email"}:${normalized}`);
}

export async function allowApiRequest(request: Request, path: string, cookie?: string, userId?: string): Promise<boolean> {
  const group = path.startsWith("/api/admin/operations/artifacts/") ? "backup-download"
    : path==="/api/admin/operations"&&request.method==="POST" ? "operations"
    : (path==="/api/account/avatar"||path==="/api/admin/media")&&request.method==="POST" ? "upload"
    : operation(path);
  const source = requestRateIdentity(request.headers, cookie);
  const accountKey = userId && `account:${rateHash(userId)}`;
  const policy = limits[group];
  if (group === "api" && accountKey) return consumeRateLimit(`api:${accountKey}`, 240);
  if(accountKey&&(group==="upload"||group==="backup-download"||group==="operations")) {
    return consumeRateLimit(`${group}:${accountKey}`,policy.browser);
  }

  if (!await consumeRateLimit(`${group}:${source.key}`, policy[source.kind])) return false;
  // Unverified clients can discard a browser cookie. Keep a bounded emergency
  // budget on costly routes without merging ordinary authenticated API traffic.
  if (group !== "api" && source.kind !== "ip" && !accountKey &&
      !await consumeRateLimit(`${group}:unverified-total`, 300)) return false;

  if (request.method !== "POST") return true;
  if ((group === "mfa" || group === "recovery") && accountKey &&
      !await consumeRateLimit(`${group}:${accountKey}`, 12)) return false;
  if (group === "login" || group === "recovery") {
    const target = await knownTarget(request, path);
    if (target && !await consumeRateLimit(`${group}:target:${target}`, group === "login" ? 12 : 8)) return false;
  }
  return true;
}
