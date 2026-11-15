import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAccount } from "@/lib/access";
import { pool } from "@/lib/db";
import { bodyJson, sameOrigin } from "@/lib/api";
const birthDate=z.iso.date().refine(d=>d<=new Date().toISOString().slice(0,10));
const completion=z.object({username:z.string().regex(/^[a-zA-Z0-9_.-]{3,30}$/),birthDate}).strict();
const profile=z.object({name:z.string().trim().min(2).max(100),birthDate,city:z.string().trim().min(1).max(100),phone:z.string().trim().max(30)}).strict();
export async function GET(){
  try{
    const a=await currentAccount();if(!a)return NextResponse.json({error:"Tidak diizinkan"},{status:401});
    const r=await pool.query('SELECT username,"birthDate",name,city,phone FROM "user" WHERE id=$1',[a.row.id]);
    return NextResponse.json({complete:Boolean(r.rows[0]?.username&&r.rows[0]?.birthDate)||Boolean(a.row.isDemo),profile:r.rows[0]},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Profil belum tersedia."},{status:503,headers:{"Cache-Control":"no-store"}})}
}
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid"},{status:403});
  let client;
  try{
    const a=await currentAccount();if(!a)return NextResponse.json({error:"Tidak diizinkan"},{status:401});
    const input=completion.safeParse(await bodyJson(request).catch(()=>null));if(!input.success)return NextResponse.json({error:"Periksa username dan tanggal lahir."},{status:400});
    client=await pool.connect();await client.query("BEGIN");
    const result=await client.query('UPDATE "user" SET username=$1,"displayUsername"=$2,"birthDate"=$3,"updatedAt"=now() WHERE id=$4 AND username IS NULL RETURNING id',[input.data.username.toLowerCase(),input.data.username,input.data.birthDate,a.row.id]);
    if(!result.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Username sudah ditetapkan."},{status:409})}
    await client.query('INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$1)',[a.row.id,"account.profile.complete"]);
    await client.query("COMMIT");return NextResponse.json({ok:true});
  }catch(error){
    if(client)await client.query("ROLLBACK").catch(()=>{});
    if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505")return NextResponse.json({error:"Username tidak tersedia."},{status:409});
    return NextResponse.json({error:"Profil belum tersimpan."},{status:503});
  }finally{client?.release()}
}
export async function PATCH(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid"},{status:403});
  let client;
  try{
    const a=await currentAccount();if(!a)return NextResponse.json({error:"Tidak diizinkan"},{status:401});
    const input=profile.safeParse(await bodyJson(request).catch(()=>null));if(!input.success)return NextResponse.json({error:"Periksa data profil."},{status:400});
    client=await pool.connect();await client.query("BEGIN");
    await client.query('UPDATE "user" SET name=$1,"birthDate"=$2,city=$3,phone=$4,"updatedAt"=now() WHERE id=$5',[input.data.name,input.data.birthDate,input.data.city,input.data.phone,a.row.id]);
    await client.query('INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[a.row.id,"account.profile.update",a.row.id]);
    await client.query("COMMIT");return NextResponse.json({ok:true});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});return NextResponse.json({error:"Profil belum tersimpan."},{status:503})}
  finally{client?.release()}
}
