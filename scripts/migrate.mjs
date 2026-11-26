import { getMigrations } from "better-auth/db/migration";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { configurationIssues } from "../src/lib/env.ts";
import { migrationVersions } from "../src/lib/schema-version.ts";

const validationMessages = new Set([
  "Checksum migrasi berubah; buat migrasi baru.",
  "Rollback ditolak: database uji masih berisi data. Gunakan database uji kosong.",
]);
const down = process.argv.includes("--down");
const issues = configurationIssues();
if (issues.length) {
  console.error(issues.join(". "));
  process.exitCode = 1;
} else if (down && (process.env.MADEVI_ENV !== "dev" || process.env.ALLOW_SCHEMA_ROLLBACK !== "true" || process.env.NODE_ENV === "production")) {
  console.error("Rollback hanya diizinkan pada database development dan harus diaktifkan secara eksplisit.");
  process.exitCode = 1;
} else {
  const { authOptions } = await import("../src/lib/auth-options.ts");
  const pool = authOptions.database;
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock(7412302)");
    await client.query("SELECT pg_advisory_lock(7412311)");
    if (!down) {
      // Better Auth uses a separate connection. Hold the lock without an open transaction.
      const migrations = await getMigrations(authOptions);
      await migrations.runMigrations();
    }
    await client.query("BEGIN");
    if (down) await rollback(client);
    else await apply(client);
    await client.query("COMMIT");
    console.log(down ? "Rollback uji selesai." : "Migrasi selesai.");
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    const message = validationMessages.has(error?.message) ? error.message : error?.constraint === "madevi_single_admin_idx"
      ? "Migrasi ditolak karena terdapat lebih dari satu akun admin. Tinjau kepemilikan sebelum mencoba kembali."
      : "Migrasi gagal. Periksa koneksi, izin skema, dan status migrasi secara privat.";
    console.error(message);
    process.exitCode = 1;
  } finally {
    await client?.query("SELECT pg_advisory_unlock(7412311)").catch(() => {});
    await client?.query("SELECT pg_advisory_unlock(7412302)").catch(() => {});
    client?.release();
    await pool.end();
  }
}

function sql(version, direction) {
  return readFile(new URL(`./migrations/${version}.${direction}.sql`, import.meta.url), "utf8");
}

async function apply(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS madevi_audit (id bigserial PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target_id text, created_at timestamptz NOT NULL DEFAULT now())`);
  await client.query(`CREATE TABLE IF NOT EXISTS madevi_reports (id bigserial PRIMARY KEY, body text NOT NULL, user_id text, rate_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  await client.query(`CREATE INDEX IF NOT EXISTS madevi_reports_rate_idx ON madevi_reports (rate_key, created_at)`);
  await client.query(`CREATE TABLE IF NOT EXISTS madevi_avatars (user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, image bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await client.query(`CREATE TABLE IF NOT EXISTS madevi_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  for (const version of migrationVersions) {
    const up = await sql(version, "up");
    const checksum = createHash("sha256").update(up).digest("hex");
    const existing = await client.query("SELECT checksum FROM madevi_schema_migrations WHERE version=$1", [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error("Checksum migrasi berubah; buat migrasi baru.");
      continue;
    }
    await client.query(up);
    await client.query("INSERT INTO madevi_schema_migrations(version,checksum) VALUES ($1,$2)", [version, checksum]);
  }
}

async function rollback(client) {
  const authTables = ["user", "session", "account", "verification", "twoFactor"];
  const { rows } = await client.query(
    `SELECT tablename FROM pg_catalog.pg_tables
     WHERE schemaname=current_schema() AND (left(tablename,7)='madevi_' OR tablename = ANY($1::text[]))
       AND tablename <> 'madevi_schema_migrations'`,
    [authTables],
  );
  for (const { tablename } of rows) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const result = await client.query(`SELECT EXISTS (SELECT 1 FROM ${quoted} LIMIT 1) AS present`);
    if (result.rows[0].present) throw new Error("Rollback ditolak: database uji masih berisi data. Gunakan database uji kosong.");
  }
  for (const version of [...migrationVersions].reverse()) {
    await client.query(await sql(version, "down"));
    await client.query("DELETE FROM madevi_schema_migrations WHERE version=$1", [version]);
  }
}
