import { apiRoute } from "@/lib/api-response";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin, slug } from "@/lib/api";
import { ContentError, copyRevision, listRevisions } from "@/lib/content";

type Params = {params:Promise<{id:string}>};
async function handleGET(request:Request,{params}:Params) {
  const admin=await currentAdmin();
  if (!admin) return failure("Tidak diizinkan",403);
  const {id}=await params;
  const before=new URL(request.url).searchParams.get("before");
  if (!z.uuid().safeParse(id).success || (before && !/^\d{1,9}$/.test(before))) return failure("Parameter tidak valid",400);
  try { return Response.json(await listRevisions({id:admin.row.id,role:"admin"},id,before?Number(before):undefined)); }
  catch(error) { return error instanceof ContentError ? failure(error.message,error.status) : failure("Riwayat belum tersedia",503); }
}
const input=z.union([
  z.object({revision:z.number().int().positive(),slug}).strict(),
  z.object({revision:z.number().int().positive(),expectedRevision:z.number().int().positive()}).strict(),
]);
async function handlePOST(request:Request,{params}:Params) {
  const admin=await currentAdmin();
  if (!admin || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  const {id}=await params;
  const data=input.safeParse(await bodyJson(request).catch(()=>null));
  if (!z.uuid().safeParse(id).success || !data.success) return failure("Data revisi tidak valid",400);
  try { return Response.json(await copyRevision({id:admin.row.id,role:"admin"},id,data.data)); }
  catch(error) { return error instanceof ContentError ? failure(error.message,error.status) : failure("Draf belum disimpan",503); }
}

export const GET=apiRoute("/api/admin/content/[id]/revisions", "GET", handleGET);
export const POST=apiRoute("/api/admin/content/[id]/revisions", "POST", handlePOST);
