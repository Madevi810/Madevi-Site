import pg from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { isDemoAllowed } from "../src/lib/config.ts";
if (!isDemoAllowed()) throw new Error("Akun demo hanya dapat dibuat di lingkungan dev lokal yang mengaktifkan demo, tanpa proxy tepercaya.");
if (!process.env.DATABASE_URL || !process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 10) throw new Error("DATABASE_URL dan DEMO_PASSWORD minimal 10 karakter wajib diisi.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const [display, role] of [["Madevi-Admin", "admin"], ["Madevi-User", "user"]]) {
    const normalized = display.toLowerCase();
    const exists = await client.query('SELECT id, "isDemo" FROM "user" WHERE username=$1', [normalized]);
    if (exists.rowCount) { if (!exists.rows[0].isDemo) throw new Error("Username sudah digunakan akun non-demo"); continue; }
    const id = randomUUID(); const now = new Date();
    await client.query('INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username, "displayUsername", "madeviRole", suspended, "isDemo", "twoFactorEnabled") VALUES ($1,$2,$3,true,$4,$4,$5,$2,$6,false,true,false)', [id, display, `${normalized}@example.invalid`, now, normalized, role]);
    await client.query('INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,\'credential\',$2,$3,$4,$4)', [randomUUID(), id, await hashPassword(process.env.DEMO_PASSWORD), now]);
  }
  await client.query("COMMIT"); console.log("Akun demo disiapkan.");
} catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); }

