import { withUploadCapacity } from "@/lib/upload-capacity";
import { apiRoute } from "@/lib/api-response";
import { observeRoute } from "@/lib/monitoring";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, readLimitedBody, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { documentType, isDocumentName, libraryMaxFile, libraryMaxTotal } from "@/lib/library-file";

async function handleGET(request:Request) {
  if(!await currentAdmin()) return failure("Tidak diizinkan",403);
  const page=z.coerce.number().int().min(1).max(1000).safeParse(new URL(request.url).searchParams.get("page")??1);
  if(!page.success)return failure("Halaman tidak valid",400);
  try {
    const {rows}=await pool.query(`SELECT id,name,mime_type,visibility,publication_reviewed_at,byte_size AS bytes,created_at,
      EXISTS(SELECT 1 FROM madevi_revision_files r WHERE r.media_id=m.id)
      OR EXISTS(SELECT 1 FROM madevi_message_jobs j WHERE j.media_id=m.id) AS linked
      FROM madevi_library m ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $1`,[(page.data-1)*25]);
    return Response.json({items:rows.slice(0,25),next:rows.length>25},{headers:{"Cache-Control":"no-store"}});
  } catch {return failure("Media belum tersedia",503);}
}
async function handlePOST(request:Request) {
  const admin=await currentAdmin();
  if(!admin || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  let stored:Buffer, name:string, visibility:string, mime:string,id:string;
  let publicationChecked=false;
  try {
    const bytes=await readLimitedBody(request,2200000);
    const form=await new Response(new Uint8Array(bytes).buffer,{headers:{"content-type":request.headers.get("content-type")??""}}).formData();
    const item=form.get("file");
    id=z.uuid().nullable().parse(form.get("id"))??randomUUID();
    name=z.string().trim().min(1).max(120).parse(form.get("name"));
    visibility=z.enum(["public","private"]).parse(form.get("visibility"));
    publicationChecked=form.get("publicationChecked")==="on";
    if(!(item instanceof File)||item.size===0||item.size>libraryMaxFile)throw new Error();
    const contents=Buffer.from(await item.arrayBuffer());
    if(isDocumentName(item.name)) {
      mime=documentType(item.name,contents);
      stored=contents;
    } else {
      const source=sharp(contents,{limitInputPixels:16000000});
      const metadata=await source.metadata();
      if(!["jpeg","webp","png"].includes(metadata.format??""))throw new Error();
      stored=await source.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
      mime="image/webp";
    }
    if(stored.length>libraryMaxFile)throw new Error();
  } catch {return failure("Gunakan JPEG, PNG, WebP, PDF, TXT UTF-8, atau CSV UTF-8 tanpa formula, sampai 2 MB.",400);}
  const publicDocument=mime!=="image/webp"&&visibility==="public";
  if(publicDocument&&!publicationChecked)return failure("Selesaikan tinjauan publikasi dokumen.",400);
  let client;
  try {
    client=await pool.connect();await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7412314)");
    const existing=(await client.query(`SELECT created_by,name,mime_type,visibility,data=$2::bytea AS same
      FROM madevi_library WHERE id=$1`,[id,stored])).rows[0];
    if(existing) {
      await client.query("ROLLBACK");
      if(existing.created_by!==admin.row.id||existing.name!==name||existing.visibility!==visibility||existing.mime_type!==mime||!existing.same) {
        return failure("ID berkas sudah dipakai untuk unggahan berbeda.",409);
      }
      return Response.json({id,mime});
    }
    const result=await client.query(`WITH inserted AS (
      INSERT INTO madevi_library(id,name,mime_type,visibility,data,created_by,publication_reviewed_at,publication_reviewed_by)
      SELECT $1,$2,$3,$4,$5,$6,CASE WHEN $9::boolean THEN now() END,CASE WHEN $9::boolean THEN $6 END WHERE (SELECT coalesce(sum(byte_size),0) FROM madevi_library)+$7<=$8 RETURNING id
    ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $6,CASE WHEN $9::boolean THEN 'media.create.reviewed' ELSE 'media.create' END,id::text FROM inserted`,
    [id,name,mime,visibility,stored,admin.row.id,stored.length,libraryMaxTotal,publicDocument]);
    await client.query("COMMIT");
    return result.rowCount?Response.json({id,mime},{status:201}):failure("Pustaka mencapai batas 256 MB.",409);
  } catch {await client?.query("ROLLBACK").catch(()=>{});return failure("Status unggahan belum dapat dikonfirmasi.",503);}
  finally {client?.release();}
}

async function handlePATCH(request:Request) {
  const admin=await currentAdmin();
  if(!admin||!sameOrigin(request))return failure("Tidak diizinkan.",403);
  const input=z.object({id:z.uuid(),publicationChecked:z.literal(true)}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!input.success)return failure("Konfirmasi tinjauan publikasi diperlukan.",400);
  const result=await pool.query(`WITH checked AS (
    UPDATE madevi_library SET publication_reviewed_at=now(),publication_reviewed_by=$2
    WHERE id=$1 AND visibility='public' AND mime_type<>'image/webp' AND publication_reviewed_at IS NULL RETURNING id
  ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $2,'media.publication.reviewed',id::text FROM checked`,
    [input.data.id,admin.row.id]);
  return result.rowCount?Response.json({ok:true}):failure("Dokumen tidak ditemukan atau sudah ditinjau.",409);
}

async function handleDELETE(request:Request) {
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

export const POST=observeRoute("library.upload",apiRoute("/api/admin/media", "POST",(request:Request)=>withUploadCapacity(()=>handlePOST(request))));

export const GET=apiRoute("/api/admin/media", "GET", handleGET);
export const DELETE=apiRoute("/api/admin/media", "DELETE", handleDELETE);

export const PATCH=apiRoute("/api/admin/media", "PATCH", handlePATCH);
