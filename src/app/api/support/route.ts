import { apiRoute } from "@/lib/api-response";
import { observeRoute } from "@/lib/monitoring";
import { currentAccount } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { consumeRateLimit } from "@/lib/rate-limit";
import { rateHash } from "@/lib/rate-identity";
import { listInput, readThreads, SupportError, updateThread, userAction } from "@/lib/support-threads";

const headers={"Cache-Control":"private, no-store"};
async function handleGET(request:Request) {
  const user=await currentAccount();
  if(!user)return failure("Masuk untuk membuka percakapan dukungan.",401);
  const filter=listInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!filter.success)return failure("Filter percakapan tidak valid.",400);
  try {return Response.json(await readThreads(filter.data,user.row.id),{headers});}
  catch(error){return error instanceof SupportError?failure(error.message,error.status):failure("Percakapan belum tersedia.",503);}
}
async function handlePOST(request:Request) {
  const user=await currentAccount();
  if(!user||!sameOrigin(request))return failure("Permintaan tidak diizinkan.",403);
  const input=userAction.safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("Isi percakapan tidak valid.",400);
  try {
    if(!await consumeRateLimit(`support:write:${rateHash(user.row.id)}`,12,600))return failure("Tunggu sebelum mengirim pesan lagi.",429,600);
    await updateThread(user.row.id,input.data);
    return Response.json({id:input.data.id},{headers});
  } catch(error){return error instanceof SupportError?failure(error.message,error.status):failure("Status penyimpanan pesan belum dapat dikonfirmasi.",503);}
}

export const GET=observeRoute("support.read",apiRoute("/api/support", "GET",handleGET));

export const POST=observeRoute("support.write",apiRoute("/api/support", "POST",handlePOST));
