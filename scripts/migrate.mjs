import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/lib/auth-options.ts";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) throw new Error("DATABASE_URL dan BETTER_AUTH_SECRET harus diisi");
const pool = authOptions.database;
const down=process.argv.includes("--down");
const versions=["001_foundation","002_notifications"];
async function sql(version,direction){return readFile(new URL(`./migrations/${version}.${direction}.sql`,import.meta.url),"utf8")}
if(down){
  if(process.env.MADEVI_ENV!=="dev" || process.env.ALLOW_SCHEMA_ROLLBACK!=="true" || process.env.NODE_ENV==="production")throw new Error("Rollback hanya diizinkan pada database development dan harus diaktifkan secara eksplisit.");
  const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(7412302)");const tables=await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname=current_schema() AND (left(tablename,7)='madevi_' OR tablename = ANY($1::text[])) AND tablename <> 'madevi_schema_migrations'",[["user","session","account","verification","twoFactor"]]);for(const {tablename} of tables.rows){const quoted='"'+tablename.replaceAll('"','""')+'"';const result=await client.query(`SELECT EXISTS (SELECT 1 FROM ${quoted} LIMIT 1) AS present`);if(result.rows[0].present)throw new Error("Rollback ditolak: database uji masih berisi data. Gunakan database uji kosong.");}for(const version of [...versions].reverse()){await client.query(await sql(version,"down"));await client.query("DELETE FROM madevi_schema_migrations WHERE version=$1",[version]);}await client.query("COMMIT");console.log("Rollback uji selesai.");}catch(e){await client.query("ROLLBACK");throw e}finally{client.release();await pool.end()}
}else{
const migrations = await getMigrations(authOptions);
await migrations.runMigrations();
await pool.query(`CREATE TABLE IF NOT EXISTS madevi_audit (id bigserial PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target_id text, created_at timestamptz NOT NULL DEFAULT now())`);
await pool.query(`CREATE TABLE IF NOT EXISTS madevi_reports (id bigserial PRIMARY KEY, body text NOT NULL, user_id text, rate_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
await pool.query(`CREATE INDEX IF NOT EXISTS madevi_reports_rate_idx ON madevi_reports (rate_key, created_at)`);
await pool.query(`CREATE TABLE IF NOT EXISTS madevi_avatars (user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, image bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
const client=await pool.connect();
try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(7412302)");await client.query("CREATE TABLE IF NOT EXISTS madevi_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");for(const version of versions){const upSql=await sql(version,"up");const checksum=createHash("sha256").update(upSql).digest("hex");const existing=await client.query("SELECT checksum FROM madevi_schema_migrations WHERE version=$1",[version]);if(existing.rowCount&&existing.rows[0].checksum!==checksum)throw new Error("Checksum migrasi berubah; buat migrasi baru.");if(!existing.rowCount){await client.query(upSql);await client.query("INSERT INTO madevi_schema_migrations(version,checksum) VALUES ($1,$2)",[version,checksum]);}}await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
await pool.end();
console.log("Migrasi selesai.");
}

