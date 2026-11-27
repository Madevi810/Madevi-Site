import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { changeSite, informationInput, readInformation, readSite, siteInput, siteResource, SiteVersionError } from "@/lib/site-config";

const headers={"Cache-Control":"no-store"};
export async function GET(request:Request) {
  if(!await currentAdmin())return failure("Tidak diizinkan",403);
  try {
    const search=new URL(request.url).searchParams;
    if(!search.has("resource"))return Response.json({settings:await readSite(),pages:await readInformation()},{headers});
    const resource=siteResource.safeParse(search.get("resource"));
    const before=z.coerce.number().int().min(1).max(2147483647).safeParse(search.get("before")??2147483647);
    if(!resource.success||!before.success)return failure("Filter riwayat tidak valid.",400);
    const {rows}=await pool.query(`SELECT version,snapshot,actor_id,created_at,restored_from FROM madevi_site_history
      WHERE resource=$1 AND version<$2 ORDER BY version DESC LIMIT 21`,[resource.data,before.data]);
    return Response.json({history:rows.slice(0,20),next:rows.length>20?rows[19].version:null},{headers});
  } catch {return failure("Pengaturan belum tersedia.",503);}
}
export async function PUT(request:Request) {
  const account=await currentAdmin();
  if(!account||!sameOrigin(request))return failure("Tidak diizinkan",403);
  const body=await bodyJson(request).catch(()=>null);
  const info=informationInput.safeParse(body),site=siteInput.safeParse(body);
  const input=info.success?info.data:site.success?site.data:null;
  if(!input)return failure("Data tidak valid.",400);
  try {
    const version=await changeSite(account.row.id,"slug" in input?input.slug:"settings",input.expectedVersion,input);
    return Response.json({ok:true,version},{headers});
  } catch(error) {return error instanceof SiteVersionError?failure(error.message,409):failure("Pengaturan belum tersimpan.",503);}
}
export async function POST(request:Request) {
  const account=await currentAdmin();
  if(!account||!sameOrigin(request))return failure("Tidak diizinkan",403);
  const result=z.object({resource:siteResource,expectedVersion:z.number().int().nonnegative(),version:z.number().int().nonnegative()})
    .strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!result.success)return failure("Snapshot tidak valid.",400);
  const {resource,version,expectedVersion}=result.data;
  try {
    return Response.json({ok:true,version:await changeSite(account.row.id,resource,expectedVersion,undefined,version)},{headers});
  } catch(error){return error instanceof SiteVersionError?failure(error.message,409):failure("Pengaturan belum dipulihkan.",503);}
}
