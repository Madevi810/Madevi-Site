import { Pool } from "pg";

declare global { var madeviPool: Pool | undefined }
// A stalled database must not hold application requests indefinitely.
function createPool() {
  const instance = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
  // pg emits errors for idle clients after a database restart. Never allow
  // the raw error/client object (which may contain credentials) into logs.
  instance.on("error", () => {
    console.error(JSON.stringify({ event: "database.pool.error", outcome: "unavailable" }));
  });
  return instance;
}
export const pool = globalThis.madeviPool ?? createPool();
globalThis.madeviPool = pool;

