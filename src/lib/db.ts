import { createDatabasePool } from "./postgres.ts";

declare global { var madeviPool: ReturnType<typeof createDatabasePool> | undefined }

export const pool = globalThis.madeviPool ?? createDatabasePool();
globalThis.madeviPool = pool;
