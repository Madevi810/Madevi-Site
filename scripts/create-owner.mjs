import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createDatabasePool } from "../src/lib/postgres.ts";

const { OWNER_USERNAME, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!OWNER_USERNAME || !/^[a-zA-Z0-9_.-]{3,30}$/.test(OWNER_USERNAME) ||
    !OWNER_EMAIL || OWNER_EMAIL.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER_EMAIL) ||
    !OWNER_PASSWORD || OWNER_PASSWORD.length < 12 || OWNER_PASSWORD.length > 128) {
  console.error("Isi OWNER_USERNAME, OWNER_EMAIL dan OWNER_PASSWORD yang valid.");
  process.exit(1);
}

let pool, client;
try {
  pool = createDatabasePool();
  const password = await hashPassword(OWNER_PASSWORD);
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(7412301)");
  const existing = await client.query('SELECT 1 FROM "user" WHERE "madeviRole"=\'admin\' LIMIT 1');
  if (existing.rowCount) throw new Error("OWNER_EXISTS");
  const id = randomUUID();
  const now = new Date();
  await client.query(
    `INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",username,"displayUsername","madeviRole",suspended,"isDemo","twoFactorEnabled")
     VALUES ($1,$2,$3,true,$4,$4,$5,$2,'admin',false,false,false)`,
    [id, OWNER_USERNAME, OWNER_EMAIL.toLowerCase(), now, OWNER_USERNAME.toLowerCase()],
  );
  await client.query(
    `INSERT INTO "account" (id,"accountId","providerId","userId",password,"createdAt","updatedAt")
     VALUES ($1,$2,'credential',$2,$3,$4,$4)`,
    [randomUUID(), id, password, now],
  );
  await client.query("COMMIT");
  console.log("Admin dibuat. Masuk lalu aktifkan autentikator sebelum membuka dashboard.");
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(error?.message === "OWNER_EXISTS" || error?.constraint === "madevi_single_admin_idx"
    ? "Admin sudah ada; pembuatan admin tunggal ditolak."
    : "Admin belum dibuat. Periksa migrasi, koneksi, dan identitas bootstrap secara privat.");
  process.exitCode = 1;
} finally {
  client?.release();
  await pool?.end();
}
