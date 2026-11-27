import { withUploadCapacity } from "@/lib/upload-capacity";
import { apiRoute } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/access";
import { getMediaStore, InvalidImageError, type Variant } from "@/lib/media";
import { readLimitedBody, sameOrigin } from "@/lib/api";
export const runtime="nodejs";
async function handleGET(request:Request){const a=await currentAccount();if(!a)return new Response(null,{status:401});const size=new URL(request.url).searchParams.get("size")||"large";if(!["small","medium","large"].includes(size))return new Response(null,{status:400});const image=await getMediaStore().getAvatar(a.row.id,size as Variant);if(!image)return new Response(null,{status:404});return new Response(new Uint8Array(image),{headers:{"Content-Type":"image/webp","X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}})}
async function handlePOST(request:Request){
 const a=await currentAccount();if(!a)return NextResponse.json({error:"Tidak diizinkan"},{status:401});
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid"},{status:403});
 let bytes:Buffer;
 try{const data=await readLimitedBody(request,1200000);const f=await new Response(new Uint8Array(data).buffer,{headers:{"content-type":request.headers.get("content-type")||""}}).formData();const file=f.get("avatar");if(!(file instanceof File)||file.size>1000000||file.size===0)throw Error();bytes=Buffer.from(await file.arrayBuffer());}
 catch{return NextResponse.json({error:"Foto tidak valid."},{status:400})}
 try{await getMediaStore().putAvatar(a.row.id,bytes);return NextResponse.json({ok:true})}
 catch(error){return NextResponse.json({error:error instanceof InvalidImageError?"Foto tidak dapat diproses.":"Foto belum tersimpan. Coba lagi nanti."},{status:error instanceof InvalidImageError?400:503})}
}
async function handleDELETE(request:Request){const account=await currentAccount();if(!account)return NextResponse.json({error:"Tidak diizinkan"},{status:401});if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid"},{status:403});const {pool}=await import('@/lib/db');const client=await pool.connect();try{await client.query('BEGIN');await client.query('DELETE FROM madevi_media_variants WHERE user_id=$1',[account.row.id]);await client.query('DELETE FROM madevi_avatars WHERE user_id=$1',[account.row.id]);await client.query('INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[account.row.id,'account.avatar.delete',account.row.id]);await client.query('COMMIT');return NextResponse.json({ok:true})}catch{await client.query('ROLLBACK');return NextResponse.json({error:'Foto belum dapat dihapus.'},{status:503})}finally{client.release()}}

export const GET=apiRoute("/api/account/avatar", "GET", handleGET);
export const POST=apiRoute("/api/account/avatar", "POST", (request:Request)=>withUploadCapacity(()=>handlePOST(request)));
export const DELETE=apiRoute("/api/account/avatar", "DELETE", handleDELETE);
