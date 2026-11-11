import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { currentAccount } from "@/lib/access";
import { clientKey } from "@/lib/rate-limit";
import { z } from "zod";
import { bodyJson,readLimitedBody,sameOrigin } from "@/lib/api";
import sharp from "sharp";
export const runtime="nodejs";
const url=z.string().trim().max(2048).refine(v=>{if(!v)return true;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}});
const schema=z.object({message:z.string().trim().min(10).max(1000),url:url.optional().default('')});
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid."},{status:403});if(!process.env.BETTER_AUTH_SECRET)return NextResponse.json({error:"Layanan belum tersedia."},{status:503});
 let data:unknown;let image:Buffer|null=null;
 try{if((request.headers.get('content-type')||'').startsWith('multipart/form-data')){const bytes=await readLimitedBody(request,2200000);const f=await new Response(new Uint8Array(bytes).buffer,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();data={message:f.get('message'),url:f.get('url')||''};const file=f.get('image');if(file instanceof File&&file.size){if(file.size>2000000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error();const source=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:16000000});const meta=await source.metadata();if(!['jpeg','png','webp'].includes(meta.format||''))throw Error();image=await source.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer()}}else data=await bodyJson(request)}catch{return NextResponse.json({error:"Foto atau data laporan tidak valid."},{status:400})}
 const input=schema.safeParse(data);if(!input.success)return NextResponse.json({error:"Periksa deskripsi dan tautan laporan."},{status:400});
 const account=await currentAccount();const key=clientKey(request.headers);const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`report-ip:${key}`]);if(account)await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`report-user:${account.row.id}`]);const byIp=await client.query("SELECT count(*)::int AS n FROM madevi_reports WHERE rate_key=$1 AND created_at > now() - interval '24 hours'",[key]);if(byIp.rows[0].n>=(account?15:3)){await client.query('ROLLBACK');return NextResponse.json({error:"Batas laporan sementara tercapai. Coba lagi dalam 24 jam."},{status:429})}if(account){const byUser=await client.query("SELECT count(*)::int AS n FROM madevi_reports WHERE user_id=$1 AND created_at > now() - interval '24 hours'",[account.row.id]);if(byUser.rows[0].n>=3){await client.query('ROLLBACK');return NextResponse.json({error:"Batas laporan sementara tercapai. Coba lagi dalam 24 jam."},{status:429})}}await client.query('INSERT INTO madevi_reports (body,user_id,rate_key,reference_url,image_webp) VALUES ($1,$2,$3,$4,$5)',[input.data.message,account?.row.id||null,key,input.data.url||null,image]);await client.query('COMMIT');return NextResponse.json({ok:true})}catch{await client.query('ROLLBACK');return NextResponse.json({error:"Laporan belum berhasil dikirim."},{status:500})}finally{client.release()}
}
