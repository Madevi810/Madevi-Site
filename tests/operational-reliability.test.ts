import assert from "node:assert/strict";
import { test } from "node:test";
import { apiRoute } from "../src/lib/api-response.ts";
// @ts-expect-error JavaScript host executors are tested directly.
import { UncertainDelivery, updateAlarms } from "../scripts/operational-alarm.mjs";
// @ts-expect-error JavaScript host executors are tested directly.
import { alertSettings } from "../scripts/alarm-settings.mjs";

test("API controls errors and ignores client-provided correlation IDs", async()=>{
  const run=apiRoute("/api/account/avatar","GET",async (_request:Request)=>{
    throw Error("postgresql://private:secret@internal/path");
  });
  const result=await run(new Request("http://localhost/api/account/avatar",{headers:{"x-request-id":"spoofed"}}));
  const data=await result.json();
  assert.equal(result.status,503);
  assert.equal(result.headers.get("cache-control"),"no-store");
  assert.match(data.requestId,/^[0-9a-f-]{36}$/);
  assert.equal(data.requestId,result.headers.get("x-request-id"));
  assert.equal(data.error.code,"UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(data),/secret|spoofed|postgresql/);
  const limited=await apiRoute("/api/support","POST",()=>Response.json({error:"Tunggu."},{status:429,headers:{"Retry-After":"300"}}))();
  assert.equal(limited.headers.get("retry-after"),"300");
  assert.equal((await limited.json()).error.code,"RATE_LIMITED");
  const redirect=await apiRoute("/api/auth/[...all]","GET",()=>Response.redirect("https://host.invalid"),true)();
  assert.equal(redirect.status,302);
  assert.equal(redirect.headers.get("location"),"https://host.invalid/");
  const auth=await apiRoute("/api/auth/[...all]","GET",()=>Response.json({code:"LIBRARY_CODE"},{status:401}),true)();
  assert.deepEqual(await auth.json(),{code:"LIBRARY_CODE"});
});

test("alarms tolerate unknown observations, deduplicate, bound repeats, and record recovery",async()=>{
  const events:string[]=[];
  const notify=async(kind:string,event:string)=>{events.push(kind+"."+event);};
  const settings={failures:2,repeatMs:3600000,maxRepeats:1};
  const first=1700000000000;
  let state=await updateAlarms({}, {readiness:false},first,settings,notify);
  state=await updateAlarms(state, {readiness:false},first+60000,settings,notify);
  state=await updateAlarms(state, {},first+120000,settings,notify);
  state=await updateAlarms(state, {readiness:false},first+180000,settings,notify);
  state=await updateAlarms(state, {readiness:false},first+7200000,settings,notify);
  state=await updateAlarms(state, {readiness:false},first+10800000,settings,notify);
  state=await updateAlarms(state, {readiness:true},first+14400000,settings,notify);
  state=await updateAlarms(state, {readiness:true},first+14460000,settings,notify);
  assert.deepEqual(events,["readiness.opened","readiness.repeat","readiness.recovered"]);
  assert.deepEqual(state,{});
});

test("SMTP failure stays visible and its retry observes the cooldown",async()=>{
  const settings={failures:2,repeatMs:3600000,maxRepeats:0};
  const since=1700000000000;
  let attempts=0, checkpoints=0;
  const fail=async()=>{attempts++;throw Error("fixture transport refused");};
  let state=await updateAlarms({}, {dispatch:false},since,settings,fail);
  state=await updateAlarms(state, {dispatch:false},since+60000,settings,fail,async()=>{checkpoints++;});
  assert.equal(state.dispatch.outcome,"failed");
  assert.equal(state.dispatch.notified,false);
  assert.equal(checkpoints,2);
  state=await updateAlarms(state, {dispatch:false},since+120000,settings,fail);
  assert.equal(attempts,1);
  state=await updateAlarms(state, {dispatch:false},since+1200000,settings,async()=>{attempts++;});
  assert.equal(attempts,2);
  assert.equal(state.dispatch.notified,true);
  assert.equal(state.dispatch.outcome,"accepted");
  assert.equal(alertSettings({}),null);
  assert.throws(()=>alertSettings({MADEVI_ALERT_TO:"ops@example.invalid"}),/invalid_alert_channel/);
});


test("SMTP failures stop after three attempts for one stage",async()=>{
  const settings={failures:2,repeatMs:3600000,maxRepeats:1};
  const since=1700000000000;
  let attempts=0,state={};
  for(let i=0;i<10;i++)state=await updateAlarms(state,{readiness:false},since+i*20*60000,settings,async()=>{
    attempts++;
    throw Error("fixture transport refused");
  });
  assert.equal(attempts,3);
});

test("recovery is sent on the next healthy probe after an accepted alarm and survives restart",async()=>{
  const first=1700000000000, minute=60000;
  const settings={failures:2,repeatMs:3600000,maxRepeats:0};
  const events:string[]=[];
  const notify=async(_kind:string,event:string)=>{events.push(event);};
  let persisted="{}";
  const checkpoint=async(state:unknown)=>{persisted=JSON.stringify(state);};
  let state=await updateAlarms({}, {readiness:false},first,settings,notify,checkpoint);
  state=await updateAlarms(state, {readiness:false},first+minute,settings,notify,checkpoint);
  state=await updateAlarms(JSON.parse(persisted), {},first+minute,settings,notify,checkpoint);
  assert.deepEqual(events,["opened"]);
  state=await updateAlarms(state, {readiness:true},first+2*minute,settings,notify,checkpoint);
  assert.deepEqual(events,["opened","recovered"]);
  state=await updateAlarms(JSON.parse(persisted), {readiness:true},first+3*minute,settings,notify,checkpoint);
  state=await updateAlarms(state, {readiness:false},first+4*minute,settings,notify,checkpoint);
  await updateAlarms(state, {readiness:false},first+5*minute,settings,notify,checkpoint);
  assert.deepEqual(events,["opened","recovered","opened"]);
});


test("an interrupted SMTP attempt keeps its retry deadline after restart",async()=>{
  const first=1700000000000, minute=60000;
  const settings={failures:2,repeatMs:3600000,maxRepeats:0};
  const events:string[]=[];
  let persisted="{}";
  const checkpoint=async(state:unknown)=>{persisted=JSON.stringify(state);};
  const notify=async(_kind:string,event:string)=>{
    events.push(event);
    if(event==="opened")throw new UncertainDelivery();
  };
  let state=await updateAlarms({}, {readiness:false},first,settings,notify,checkpoint);
  state=await updateAlarms(state, {readiness:false},first+minute,settings,notify,checkpoint);
  assert.equal(state.readiness.outcome,"uncertain");
  state=await updateAlarms(JSON.parse(persisted), {readiness:true},first+2*minute,settings,notify,checkpoint);
  assert.deepEqual(events,["opened"]);
  state=await updateAlarms(state, {readiness:true},first+16*minute,settings,notify,checkpoint);
  assert.deepEqual(events,["opened","recovered"]);
  assert.deepEqual(state,{});
});
