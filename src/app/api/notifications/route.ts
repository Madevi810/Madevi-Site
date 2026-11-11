import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/access";
import { bodyJson, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { encodeNotificationCursor, parseNotificationQuery } from "@/lib/notification-query";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const parsed=parseNotificationQuery(request.url);
  if(!parsed.success)return NextResponse.json({error:"Parameter notifikasi tidak valid."},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    const account=await currentAccount();const id=account?.row.id||null;const {category,limit,after}=parsed.data;
    const {rows}=await pool.query(`SELECT n.id,n.category,n.title,n.body,n.created_at,
      to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
      (r.read_at IS NOT NULL) AS is_read
      FROM madevi_notifications n LEFT JOIN madevi_notification_reads r ON r.notification_id=n.id AND r.user_id=$1
      WHERE (n.category='general' OR (n.recipient_id=$1 AND n.category IN ('system','social')))
      AND ($2::text IS NULL OR n.category=$2)
      AND ($3::timestamptz IS NULL OR (n.created_at,n.id)<($3::timestamptz,$4::uuid))
      ORDER BY n.created_at DESC,n.id DESC LIMIT $5`,[id,category||null,after?.time||null,after?.id||null,limit+1]);
    const hasMore=rows.length>limit;const items=rows.slice(0,limit);const last=items.at(-1);
    const nextCursor=hasMore&&last?encodeNotificationCursor({time:last.cursor_time,id:last.id}):null;
    return NextResponse.json({notifications:items.map(({cursor_time,...notice})=>notice),signedIn:Boolean(account),nextCursor},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"Notifikasi belum tersedia."},{status:503,headers:{"Cache-Control":"no-store"}})}
}
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak valid."},{status:403});
  const account=await currentAccount();if(!account)return NextResponse.json({error:"Masuk untuk menandai notifikasi."},{status:401});
  const parsed=z.object({id:z.uuid()}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Notifikasi tidak valid."},{status:400});
  try{const r=await pool.query(`INSERT INTO madevi_notification_reads(notification_id,user_id) SELECT id,$2 FROM madevi_notifications WHERE id=$1 AND (category='general' OR recipient_id=$2) ON CONFLICT DO NOTHING RETURNING notification_id`,[parsed.data.id,account.row.id]);return NextResponse.json({ok:true,updated:Boolean(r.rowCount)},{headers:{"Cache-Control":"no-store"}})}
  catch{return NextResponse.json({error:"Status notifikasi belum tersimpan."},{status:503,headers:{"Cache-Control":"no-store"}})}
}
