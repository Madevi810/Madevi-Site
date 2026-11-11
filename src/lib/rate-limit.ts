import { createHmac } from "node:crypto";
import { pool } from "./db";
export function clientKey(headers:Headers):string {
  const ip=process.env.TRUST_PROXY_HEADERS==="true" ? headers.get("x-real-ip") || "unknown" : "unknown";
  return createHmac("sha256",process.env.BETTER_AUTH_SECRET||"").update(ip.slice(0,100)).digest("hex");
}
export async function consumeRateLimit(key:string,limit:number,windowSeconds:number):Promise<{allowed:boolean;remaining:number}> {
  const result=await pool.query(`INSERT INTO madevi_rate_limits (key,window_start,hits) VALUES ($1,now(),1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN madevi_rate_limits.window_start <= now()-($2::int * interval '1 second') THEN 1 ELSE madevi_rate_limits.hits+1 END, window_start=CASE WHEN madevi_rate_limits.window_start <= now()-($2::int * interval '1 second') THEN now() ELSE madevi_rate_limits.window_start END RETURNING hits`,[key,windowSeconds]);
  const hits=Number(result.rows[0].hits);return {allowed:hits<=limit,remaining:Math.max(0,limit-hits)};
}
