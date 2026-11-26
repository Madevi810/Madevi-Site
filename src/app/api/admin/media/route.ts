import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, readLimitedBody, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";

export async function GET(request:Request) {
  if(!await currentAdmin()) return failure("Tidak diizinkan",403);
  const page=z.coerce.number().int().min(1).max(1000).safeParse(new URL(request.url).searchParams.get("page")??1);
  if(!page.success)return failure("Halaman tidak valid",400);
  try {
    const {rows}=await pool.query(`SELECT id,name,visibility,octet_length(data) AS bytes,created_at,
      EXISTS(SELECT 1 FROM madevi_revision_files r WHERE r.media_id=m.id)
      OR EXISTS(SELECT 1 FROM madevi_message_jobs j WHERE j.media_id=m.id) AS linked
      FROM madevi_library m ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $1`,[(page.data-1)*25]);
    return Response.json({items:rows.slice(0,25),next:rows.length>25},{headers:{"Cache-Control":"no-store"}});
  } catch {return failure("Media belum tersedia",503);}
}
export async function POST(request:Request) {
  const admin=await currentAdmin();
  if(!admin || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  let image:Buffer, name:string, visibility:string;
  try {
    const bytes=await readLimitedBody(request,2200000);
    const form=await new Response(new Uint8Array(bytes).buffer,{headers:{"content-type":request.headers.get("content-type")??""}}).formData();
    const item=form.get("file");
    name=z.string().trim().min(1).max(120).parse(form.get("name"));
    visibility=z.enum(["public","private"]).parse(form.get("visibility"));
    if(!(item instanceof File)||item.size===0||item.size>2000000)throw new Error();
    const source=sharp(Buffer.from(await item.arrayBuffer()),{limitInputPixels:16000000});
    const metadata=await source.metadata();
    if(!["jpeg","webp","png"].includes(metadata.format??""))throw new Error();
    image=await source.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
    if(image.length>2000000)throw new Error();
  } catch {return failure("Gunakan gambar JPEG, PNG atau WebP sampai 2 MB",400);}
  try {
    const id=randomUUID();
    await pool.query(`WITH inserted AS (
      INSERT INTO madevi_library(id,name,mime_type,visibility,data,created_by) VALUES($1,$2,'image/webp',$3,$4,$5) RETURNING id
    ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $5,'media.create',id::text FROM inserted`,[id,name,visibility,image,admin.row.id]);
    return Response.json({id},{status:201});
  } catch {return failure("Media belum disimpan",503);}
}
export async function DELETE(request:Request) {
  const admin=await currentAdmin();
  if(!admin || !sameOrigin(request))return failure("Tidak diizinkan",403);
  const data=z.object({id:z.uuid()}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!data.success)return failure("ID media tidak valid",400);
  try {
    const result=await pool.query(`WITH removed AS (DELETE FROM madevi_library WHERE id=$1 RETURNING id)
      INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $2,'media.delete',id::text FROM removed`,[data.data.id,admin.row.id]);
    return result.rowCount ? Response.json({ok:true}) : failure("Media tidak ditemukan",404);
  } catch(error) {
    return (error as {code?:string}).code==="23503" ? failure("Media masih dipakai pada revisi atau pesan",409) : failure("Media belum dihapus",503);
  }
}
