import { z } from "zod";
import { currentAccount, currentAdmin } from "@/lib/access";
import { pool } from "@/lib/db";
import { failure } from "@/lib/api";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!z.uuid().safeParse(id).success)return failure("Media tidak ditemukan",404);
  try {
    const account=await currentAccount();
    const admin=account?.row.madeviRole==="admin" && Boolean(await currentAdmin());
    const {rows}=await pool.query(`SELECT data FROM madevi_library m WHERE id=$1 AND (
      $2::boolean OR
      (m.visibility='public' AND EXISTS (
        SELECT 1 FROM madevi_revision_files f JOIN madevi_content c ON c.id=f.content_id AND c.published_revision=f.revision
        WHERE f.media_id=m.id AND c.deleted_at IS NULL AND c.workflow_status<>'archived'
      )) OR EXISTS (
        SELECT 1 FROM madevi_message_jobs j JOIN madevi_notifications n ON n.job_id=j.id
        WHERE j.media_id=m.id AND j.status='sent' AND n.recipient_id=$3
      ))`,[id,admin,account?.row.id??null]);
    if(!rows[0])return failure("Media tidak ditemukan",404);
    return new Response(new Uint8Array(rows[0].data),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
  } catch {return failure("Media sementara tidak tersedia",503);}
}
