import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){try{const r=await pool.query("SELECT 1 FROM madevi_schema_migrations WHERE version=$1",["002_notifications"]);if(!r.rowCount)throw Error();return NextResponse.json({status:"ok",database:"ok"},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({status:"not_ready"},{status:503,headers:{"Cache-Control":"no-store"}})}}
