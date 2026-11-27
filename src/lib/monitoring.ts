import "server-only";
import { after } from "next/server";
import { pool } from "./db";

export const monitoredLabels={
  "operations.request":"Permintaan operasi admin",
  "messages.write":"Penyimpanan dan pengiriman pesan admin",
  "library.upload":"Unggah ke pustaka",
  "library.read":"Pemberian header lampiran",
  "support.read":"Baca percakapan pengguna",
  "support.write":"Tulis percakapan pengguna",
  "support.admin":"Tindakan percakapan admin",
  "report.write":"Pengiriman laporan",
} as const;

let failureHour=0;

export function observeRoute<Args extends unknown[]>(route:keyof typeof monitoredLabels,handler:(...args:Args)=>Promise<Response>) {
  return async (...args:Args) => {
    const start=performance.now();
    const result=await handler(...args);
    const ms=Math.min(3600000,Math.max(0,Math.round(performance.now()-start)));
    const outcome=result.status>=500?"error":result.status>=400?"client":"ok";
    // The handler already produced its HTTP status. Keep metrics failures outside that response.
    try {
      after(async()=>{
        await pool.query(`INSERT INTO madevi_monitor_buckets(hour,route,result,count,total_ms,max_ms)
          VALUES(date_trunc('hour',now(),'UTC'),$1,$2,1,$3::int,$3::int)
          ON CONFLICT(hour,route,result) DO UPDATE SET count=madevi_monitor_buckets.count+1,
          total_ms=madevi_monitor_buckets.total_ms+$3::int,max_ms=greatest(madevi_monitor_buckets.max_ms,$3::int),
          updated_at=now()`,[route,outcome,ms]).catch((error:{code?:string})=>{
            const hour=Math.floor(Date.now()/3600000);
            if(failureHour===hour)return;
            failureHour=hour;
            console.warn(JSON.stringify({event:"monitoring.storage_unavailable",code:/^[0-9A-Z]{5}$/.test(error.code??"")?error.code:"unavailable"}));
          });
      });
    } catch {}
    return result;
  };
}
