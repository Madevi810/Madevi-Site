import { Pool } from "pg";

declare global { var madeviPool: Pool | undefined }
export const pool = globalThis.madeviPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
globalThis.madeviPool = pool;

