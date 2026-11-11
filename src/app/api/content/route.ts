import { NextResponse } from "next/server";
import { listContent } from "@/lib/content";
import { failure,parseQuery } from "@/lib/api";
export const dynamic="force-dynamic";
export async function GET(request:Request){const query=parseQuery(request.url);if(!query.success || query.data.status)return failure("Parameter tidak valid",400);try{return NextResponse.json(await listContent(query.data),{headers:{"Cache-Control":"no-store"}})}catch{return failure("Data belum tersedia",503)}}

