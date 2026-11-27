import { apiRoute } from "@/lib/api-response";
import { z } from "zod";
import { currentPrincipal } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { parseAdminReportsQuery } from "@/lib/admin-reports-query";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store"};
const priorities = z.enum(["low","normal","high","urgent"]);

async function handleGET(request:Request) {
  if(!await currentPrincipal("reports.read")) return failure("Tidak diizinkan",403);
  const parsed = parseAdminReportsQuery(request.url);
  if(!parsed.success) return failure("Parameter tidak valid",400);
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  const priority = priorities.optional().safeParse(query.get("priority") ?? undefined);
  if(!priority.success || (id && !/^\d{1,18}$/.test(id))) return failure("Parameter tidak valid",400);
  try {
    if(id) {
      const {rows} = await pool.query("SELECT actor_id,status,priority,note,created_at FROM madevi_report_events WHERE report_id=$1 ORDER BY id DESC LIMIT 100", [id]);
      return Response.json({history:rows},{headers});
    }
    const {page,limit,status} = parsed.data;
    const {rows} = await pool.query(`SELECT id,body,user_id,reference_url,status,priority,automatic_response,
      (image_webp IS NOT NULL) AS has_image,created_at FROM madevi_reports
      WHERE ($1::text IS NULL OR status=$1) AND ($4::text IS NULL OR priority=$4)
      ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [status||null,limit+1,(page-1)*limit,priority.data??null]);
    return Response.json({reports:rows.slice(0,limit),pagination:{page,hasNext:rows.length>limit}},{headers});
  } catch { return failure("Laporan belum tersedia",503); }
}

const edit = z.object({id:z.number().int().positive(), status:z.enum(["new","in_progress","resolved","spam"]),
  priority:priorities.optional(), note:z.string().trim().max(1000).default("")}).strict();

async function handlePATCH(request:Request) {
  const actor = await currentPrincipal("reports.read");
  if(!actor || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  const input = edit.safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success) return failure("Data tidak valid",400);
  const {id,status,priority,note} = input.data;
  try {
    const result = await pool.query(`WITH changed AS (
      UPDATE madevi_reports SET status=$1,priority=coalesce($2,priority) WHERE id=$3 RETURNING id,status,priority
    ), history AS (
      INSERT INTO madevi_report_events(report_id,actor_id,status,priority,note)
      SELECT id,$4,status,priority,$5 FROM changed
    ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $4,'report.status:' || status,id::text FROM changed`,
    [status,priority??null,id,actor.row.id,note]);
    return result.rowCount ? Response.json({ok:true}) : failure("Laporan tidak ditemukan",404);
  } catch { return failure("Status belum tersimpan",503); }
}

export const GET=apiRoute("/api/admin/reports", "GET", handleGET);
export const PATCH=apiRoute("/api/admin/reports", "PATCH", handlePATCH);
