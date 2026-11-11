import { NextResponse } from "next/server";
import { z } from "zod";
import { spaces,slug,failure } from "@/lib/api";
import { pool } from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{space:string;slug:string}>}){const p=await params;if(!z.enum(spaces).safeParse(p.space).success||!slug.safeParse(p.slug).success)return failure("Tidak ditemukan",404);try{const r=await pool.query("SELECT c.space,c.content_type AS type,c.slug,r.title,r.body,r.metadata,c.updated_at FROM madevi_content c JOIN madevi_content_revisions r ON r.content_id=c.id AND r.revision=c.published_revision WHERE c.space=$1 AND c.slug=$2 AND c.published_revision IS NOT NULL AND c.workflow_status<>'archived'",[p.space,p.slug]);if(!r.rowCount)return failure("Tidak ditemukan",404);return NextResponse.json(r.rows[0],{headers:{"Cache-Control":"no-store"}})}catch{return failure("Data belum tersedia",503)}}
