import { apiRoute } from "@/lib/api-response";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { readAvailability } from "@/lib/support-threads";
import { availabilityInput, isAdminAvailable } from "@/lib/support-availability";

async function handleGET() {
  if(!await currentAdmin())return failure("Tidak diizinkan.",403);
  try {
    const state=await readAvailability();
    return Response.json({...state,available:isAdminAvailable(state.settings,new Date())},{headers:{"Cache-Control":"no-store"}});
  } catch {return failure("Pengaturan dukungan belum tersedia.",503);}
}

async function handlePUT(request:Request) {
  const admin=await currentAdmin();
  if(!admin||!sameOrigin(request))return failure("Tidak diizinkan.",403);
  const input=z.object({settings:availabilityInput,version:z.number().int().nonnegative()}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("Gunakan zona seperti Asia/Jakarta, maksimal 28 rentang tanpa tumpang tindih, dan jawaban hingga 2.000 karakter.",400);
  try {
    const result=await pool.query(`WITH changed AS (
      INSERT INTO madevi_support_availability(id,config) SELECT 1,$1 WHERE $2=0 OR EXISTS(SELECT FROM madevi_support_availability WHERE id=1)
      ON CONFLICT(id) DO UPDATE SET config=$1,version=madevi_support_availability.version+1 WHERE madevi_support_availability.version=$2 RETURNING id
    ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $3,'support.availability',id::text FROM changed`,[input.data.settings,input.data.version,admin.row.id]);
    return result.rowCount?Response.json({ok:true}):failure("Pengaturan berubah. Muat ulang.",409);
  } catch {return failure("Pengaturan belum tersimpan.",503);}
}

export const GET=apiRoute("/api/admin/support/availability", "GET", handleGET);
export const PUT=apiRoute("/api/admin/support/availability", "PUT", handlePUT);
