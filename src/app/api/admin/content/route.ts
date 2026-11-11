import { NextResponse } from "next/server";
import { currentPrincipal } from "@/lib/access";
import { bodyJson,contentInput,failure,parseQuery,sameOrigin } from "@/lib/api";
import { ContentError,createContent,listContent } from "@/lib/content";
export const dynamic="force-dynamic";
export async function GET(request:Request){const a=await currentPrincipal("content.readAny")||await currentPrincipal("content.readOwn");if(!a)return failure("Tidak diizinkan",403);const q=parseQuery(request.url);if(!q.success)return failure("Parameter tidak valid",400);try{return NextResponse.json(await listContent(q.data,{id:a.row.id,role:a.row.madeviRole}),{headers:{"Cache-Control":"no-store"}})}catch{return failure("Data belum tersedia",503)}}
export async function POST(request:Request){const a=await currentPrincipal("content.create");if(!a)return failure("Tidak diizinkan",403);if(!sameOrigin(request))return failure("Asal permintaan tidak valid",403);try{const data=contentInput.safeParse(await bodyJson(request));if(!data.success)return failure("Data konten tidak valid",400);return NextResponse.json(await createContent({id:a.row.id,role:a.row.madeviRole},data.data),{status:201})}catch(e){if(e instanceof ContentError)return failure(e.message,e.status);if((e as {code?:string}).code==="23505")return failure("Slug sudah digunakan",409);return failure("Konten belum berhasil dibuat",400)}}

