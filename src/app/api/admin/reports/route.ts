import { NextResponse } from "next/server";
import { z } from "zod";
import { currentPrincipal } from "@/lib/access";
import { bodyJson,sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { parseAdminReportsQuery } from "@/lib/admin-reports-query";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await currentPrincipal("reports.read"))return NextResponse.json({error:"Tidak diizinkan"},{status:403});
 const parsed=parseAdminReportsQuery(request.url);if(!parsed.success)return NextResponse.json({error:"Parameter tidak valid"},{status:400});
 const {page,limit,status}=parsed.data;
 try{const {rows}=await pool.query(`SELECT id,body,user_id,reference_url,status,(image_webp IS NOT NULL) AS has_image,created_at FROM madevi_reports WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,[status||null,limit+1,(page-1)*limit]);return NextResponse.json({reports:rows.slice(0,limit),pagination:{page,limit,hasNext:rows.length>limit}},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Laporan belum tersedia"},{status:503,headers:{"Cache-Control":"no-store"}})}
}
export async function PATCH(request:Request){const actor=await currentPrincipal('reports.read');if(!actor)return NextResponse.json({error:"Tidak diizinkan"},{status:403});if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid"},{status:403});const input=z.object({id:z.number().int().positive(),status:z.enum(['new','in_progress','resolved','spam'])}).strict().safeParse(await bodyJson(request).catch(()=>null));if(!input.success)return NextResponse.json({error:"Data tidak valid"},{status:400});const client=await pool.connect();try{await client.query('BEGIN');const result=await client.query('UPDATE madevi_reports SET status=$1 WHERE id=$2 RETURNING id',[input.data.status,input.data.id]);if(!result.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:"Laporan tidak ditemukan"},{status:404})}await client.query('INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[actor.row.id,`report.status:${input.data.status}`,String(input.data.id)]);await client.query('COMMIT');return NextResponse.json({ok:true})}catch{await client.query('ROLLBACK');return NextResponse.json({error:"Status tidak tersimpan"},{status:503})}finally{client.release()}}
