import { apiRoute } from "@/lib/api-response";
import { Readable } from "node:stream";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { failure } from "@/lib/api";
import { pool } from "@/lib/db";
import { openBackup } from "@/lib/backup-artifact";

async function handleGET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const admin=await currentAdmin();
  if(!admin||!admin.row.madeviMfa||!admin.row.twoFactorEnabled||admin.row.isDemo)return failure("Diperlukan sesi admin dengan MFA.",403);
  const {id}=await params;
  if(!z.uuid().safeParse(id).success)return failure("Artefak tidak ditemukan.",404);
  const directory=process.env.MADEVI_BACKUP_DOWNLOAD_DIR;
  if(!directory)return failure("Direktori unduhan belum dihubungkan.",503);
  try {
    const result=await pool.query("SELECT artifact,bytes FROM madevi_operations WHERE id=$1 AND kind='backup' AND status='completed'",[id]);
    const item=result.rows[0];
    if(!item)return failure("Artefak tidak ditemukan.",404);
    const {handle,size}=await openBackup(directory,item.artifact);
    if(String(size)!==item.bytes) {
      await handle.close();
      return failure("Ukuran arsip berubah. Verifikasi arsip sebelum digunakan.",409);
    }
    try {await pool.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,'operations.download',$2)",[admin.row.id,id]);}
    catch(error){await handle.close();throw error;}
    return new Response(Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>,{headers:{
      "Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${item.artifact}"`,
      "Content-Length":String(size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
    }});
  } catch {return failure("Artefak tidak tersedia pada direktori unduhan.",503);}
}

export const GET=apiRoute("/api/admin/operations/artifacts/[id]", "GET", handleGET);
