import { APIError } from "better-auth/api";
import { pool } from "./db.ts";

export function isPrivileged(role: string): boolean {
  return ["admin", "author", "reviewer", "moderator"].includes(role);
}

export function privilegedSessionPath(path: string | undefined): boolean {
  return path === "/sign-in/email" || path === "/sign-in/username" || verifiedMfaPath(path);
}

export function verifiedMfaPath(path: string | undefined): boolean {
  return path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code";
}

export function denyPrivilegedOAuth(): never {
  throw new APIError("FORBIDDEN", { message: "Akun pengelola masuk dengan kata sandi dan autentikator." });
}

export async function assertGoogleAccountAllowed(profile: { sub: string; email: string }) {
  const result = await pool.query<{ madeviRole: string }>(
    `SELECT "madeviRole" FROM "user" WHERE email = $1
     UNION ALL
     SELECT u."madeviRole" FROM "account" a JOIN "user" u ON u.id = a."userId"
     WHERE a."providerId" = 'google' AND a."accountId" = $2`,
    [profile.email.normalize("NFC").toLowerCase(), profile.sub],
  );
  if (result.rows.some(user => isPrivileged(user.madeviRole))) denyPrivilegedOAuth();
  return {};
}
