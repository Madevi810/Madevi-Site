import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { failure } from "@/lib/api";
import { pool } from "@/lib/db";
import { checkDatabaseReadiness } from "@/lib/readiness";
import { backupSettings } from "@/lib/env";

export async function GET(request:Request) {
  if(!await currentAdmin())return failure("Tidak diizinkan",403);
  const page=z.coerce.number().int().min(1).max(10000).safeParse(new URL(request.url).searchParams.get("page")??1);
  if(!page.success)return failure("Halaman tidak valid",400);
  const readiness=await checkDatabaseReadiness(pool);
  const backupConfigured=Boolean(backupSettings());
  try {
    const [jobs,migrations]=await Promise.all([
      pool.query(`SELECT id,kind,status,artifact,bytes,started_at,finished_at,details,
        extract(epoch from finished_at-started_at)::int AS seconds FROM madevi_operations ORDER BY started_at DESC,id DESC LIMIT 26 OFFSET $1`,[(page.data-1)*25]),
      pool.query("SELECT version,checksum,applied_at FROM madevi_schema_migrations ORDER BY version DESC")
    ]);
    return Response.json({readiness,backupConfigured,jobs:jobs.rows.slice(0,25),next:jobs.rows.length>25,migrations:migrations.rows},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({readiness,backupConfigured,jobs:null,next:false,migrations:null},{headers:{"Cache-Control":"no-store"}});
  }
}
