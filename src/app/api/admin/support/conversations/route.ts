import { apiRoute } from "@/lib/api-response";
import { observeRoute } from "@/lib/monitoring";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { adminAction, listInput, readThreads, SupportError, updateThread } from "@/lib/support-threads";

const headers={"Cache-Control":"no-store"};
async function handleGET(request:Request) {
  if(!await currentAdmin())return failure("Tidak diizinkan.",403);
  const filter=listInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!filter.success)return failure("Filter percakapan tidak valid.",400);
  try {return Response.json(await readThreads(filter.data),{headers});}
  catch(error){return error instanceof SupportError?failure(error.message,error.status):failure("Antrean belum tersedia.",503);}
}
async function handlePOST(request:Request) {
  const admin=await currentAdmin();
  if(!admin||!sameOrigin(request))return failure("Tidak diizinkan.",403);
  const input=adminAction.safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("Tindakan percakapan tidak valid.",400);
  try {
    await updateThread(admin.row.id,input.data,true);
    return Response.json({id:input.data.id},{headers});
  } catch(error){return error instanceof SupportError?failure(error.message,error.status):failure("Status penyimpanan tindakan belum dapat dikonfirmasi.",503);}
}

export const POST=observeRoute("support.admin",apiRoute("/api/admin/support/conversations", "POST",handlePOST));

export const GET=apiRoute("/api/admin/support/conversations", "GET", handleGET);
