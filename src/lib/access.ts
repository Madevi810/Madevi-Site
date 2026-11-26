import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth-config";
import { pool } from "./db";
import { isDemoAllowed } from "./config";
import { isPrivileged } from "./auth-policy";
import { can, type Permission } from "./permissions";

export async function currentAuthenticationAccount() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const result = await pool.query(
    `SELECT u.id, u."madeviRole", u.suspended, u."isDemo", u."twoFactorEnabled", u.username, s."madeviMfa"
     FROM "user" u JOIN "session" s ON s."userId" = u.id WHERE u.id = $1 AND s.id = $2`,
    [session.user.id, session.session.id],
  );
  const row = result.rows[0];
  if (!row || row.suspended || (row.isDemo && !isDemoAllowed())) return null;
  return { session, row };
}

export function hasAdministrativeMfa(row: {
  madeviRole: string; twoFactorEnabled: boolean; madeviMfa: boolean; isDemo: boolean;
}) {
  return Boolean(row.twoFactorEnabled && row.madeviMfa) ||
    (row.isDemo && row.madeviRole === "admin" && isDemoAllowed());
}

export async function currentAccount({ allowMfaEnrollment = false } = {}) {
  const account = await currentAuthenticationAccount();
  if (!account) return null;
  const { row } = account;
  const enrolling = allowMfaEnrollment && row.madeviRole === "admin" && !row.twoFactorEnabled;
  return !isPrivileged(row.madeviRole) || enrolling || hasAdministrativeMfa(row) ? account : null;
}

export async function currentAdmin() {
  const account = await currentAccount();
  if (!account || account.row.madeviRole !== "admin") return null;
  return account;
}

export async function currentPrincipal(permission: Permission) {
  const account = await currentAccount();
  if (!account || !can(account.row.madeviRole, permission)) return null;
  return account;
}

