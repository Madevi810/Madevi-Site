import { Pool } from "pg";
import { databaseUrl } from "./env.ts";

export function createDatabasePool(url = databaseUrl(), max = 10) {
  const pool = new Pool({
    connectionString: url,
    max,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
  pool.on("error", () => {
    console.error(JSON.stringify({ event: "database.pool.error", outcome: "unavailable" }));
  });
  return pool;
}
