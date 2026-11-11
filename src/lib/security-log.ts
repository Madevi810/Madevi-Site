type SecurityEvent = "auth.attempt"|"admin.account"|"content.action"|"rate.limited"|"environment.failure";
export function securityLog(event:SecurityEvent,details:{outcome:string;action?:string;status?:number}):void {
  console.info(JSON.stringify({time:new Date().toISOString(),level:"info",event,...details}));
}
export async function recordSecurityEvent(event:SecurityEvent,details:{outcome:string;action?:string;status?:number}):Promise<void>{
  securityLog(event,details);
  try { const {pool}=await import("./db");await pool.query("INSERT INTO madevi_security_events(event,outcome,action,status) VALUES ($1,$2,$3,$4)",[event,details.outcome,details.action||null,details.status||null]); }
  catch { console.error(JSON.stringify({time:new Date().toISOString(),level:"error",event:"security_log.write_failed"})); }
}
