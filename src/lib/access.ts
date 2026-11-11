import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth-config";
import { pool } from "./db";
import { isDemoAllowed } from "./config";
import { can, type Permission } from "./permissions";

export async function currentAccount() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const result = await pool.query('SELECT id, "madeviRole", suspended, "isDemo", "twoFactorEnabled", username FROM "user" WHERE id=$1', [session.user.id]);
  const row = result.rows[0];
  if (!row || row.suspended || (row.isDemo && !isDemoAllowed())) return null;
  return { session, row };
}

export async function currentAdmin() {
  const account = await currentAccount();
  if (!account || account.row.madeviRole !== "admin") return null;
  if (!account.row.twoFactorEnabled && !(account.row.isDemo && isDemoAllowed())) return null;
  return account;
}

export async function currentPrincipal(permission: Permission) {
  const account = await currentAccount();
  if (!account || !can(account.row.madeviRole, permission)) return null;
  // Staff capabilities require MFA; the only exception is the isolated demo admin.
  if (!account.row.twoFactorEnabled && !(account.row.madeviRole === "admin" && account.row.isDemo && isDemoAllowed())) return null;
  return account;
}

