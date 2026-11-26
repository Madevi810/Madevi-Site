import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { currentAccount } from "@/lib/access";
import { cookies } from "next/headers";
import { rateCookie, rateHash, requestRateIdentity } from "@/lib/rate-identity";
import { z } from "zod";
import { bodyJson,readLimitedBody,sameOrigin } from "@/lib/api";
import sharp from "sharp";
export const runtime="nodejs";
const url=z.string().trim().max(2048).refine(v=>{if(!v)return true;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}});
const schema=z.object({message:z.string().trim().min(10).max(1000),url:url.optional().default('')});
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid."},{status:403});
 let data:unknown;let image:Buffer|null=null;
 try{if((request.headers.get('content-type')||'').startsWith('multipart/form-data')){const bytes=await readLimitedBody(request,2200000);const f=await new Response(new Uint8Array(bytes).buffer,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();data={message:f.get('message'),url:f.get('url')||''};const file=f.get('image');if(file instanceof File&&file.size){if(file.size>2000000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error();const source=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:16000000});const meta=await source.metadata();if(!['jpeg','png','webp'].includes(meta.format||''))throw Error();image=await source.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer()}}else data=await bodyJson(request)}catch{return NextResponse.json({error:"Foto atau data laporan tidak valid."},{status:400})}
 const input=schema.safeParse(data);if(!input.success)return NextResponse.json({error:"Periksa deskripsi dan tautan laporan."},{status:400});
 let client;
 try {
  const account = await currentAccount();
  const source = requestRateIdentity(request.headers, (await cookies()).get(rateCookie)?.value);
  const key = account ? `account:${rateHash(account.row.id)}` : source.key.startsWith("browser:") ? `browser:${rateHash(source.key)}` : source.key;
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`report:${key}`]);
  const count = account
    ? await client.query("SELECT count(*)::int AS n FROM madevi_reports WHERE user_id=$1 AND created_at > now() - interval '24 hours'", [account.row.id])
    : await client.query("SELECT count(*)::int AS n FROM madevi_reports WHERE rate_key=$1 AND created_at > now() - interval '24 hours'", [key]);
  if (count.rows[0].n >= 3) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Batas laporan sementara tercapai. Coba lagi dalam 24 jam." }, { status: 429 });
  }
  const response = await client.query(`SELECT response FROM madevi_support_rules
    WHERE enabled AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())
    AND (keyword IS NULL OR position(keyword in lower($1))>0) ORDER BY length(keyword) DESC NULLS LAST,id LIMIT 1`,[input.data.message]);
  const automaticResponse: string | null = response.rows[0]?.response ?? null;
  await client.query(
    "INSERT INTO madevi_reports (body,user_id,rate_key,reference_url,image_webp,automatic_response) VALUES ($1,$2,$3,$4,$5,$6)",
    [input.data.message,account?.row.id||null,key,input.data.url||null,image,automaticResponse],
  );
  await client.query("COMMIT");
  return NextResponse.json({ok:true,automaticResponse});
 } catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  return NextResponse.json({ error: "Laporan belum berhasil dikirim." }, { status: 503 });
 } finally {
  client?.release();
 }
}
