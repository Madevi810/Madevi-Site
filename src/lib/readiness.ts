import type { Pool } from "pg";
import { migrationVersions } from "./schema-version.ts";

export async function checkDatabaseReadiness(pool: Pool): Promise<"ready" | "schema_pending" | "database_unavailable"> {
  try {
    const result = await pool.query<{ versions: number; adminIndex: boolean }>(
      `SELECT count(*)::int AS versions, to_regclass('madevi_single_admin_idx') IS NOT NULL AS "adminIndex"
       FROM madevi_schema_migrations WHERE version = ANY($1::text[])`, [migrationVersions],
    );
    if (result.rows[0]?.versions !== migrationVersions.length || !result.rows[0].adminIndex) return "schema_pending";
    await pool.query('SELECT "madeviMfa" FROM "session" LIMIT 0');
    return "ready";
  } catch (error) {
    const code = (error as { code?: string })?.code;
    return code === "42P01" || code === "42703" ? "schema_pending" : "database_unavailable";
  }
}
