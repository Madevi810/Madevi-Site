import { NextResponse } from "next/server";
import { z } from "zod";

export const spaces = ["explore","tutorial","school","shop","tools","services","line"] as const;
export const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const safeJson = z.record(z.string().max(80), z.unknown()).refine(value => JSON.stringify(value).length <= 20000, "Ukuran data terlalu besar");
export const contentInput = z.object({ space: z.enum(spaces), type: z.string().regex(/^[a-z][a-z0-9_-]{1,49}$/), slug, title: z.string().trim().min(1).max(200), body: safeJson, metadata: safeJson.default({}) }).strict();
export const revisionInput = contentInput.pick({ title:true, body:true, metadata:true }).extend({ expectedRevision:z.number().int().min(1) }).strict();
export const transitionInput = z.object({ action:z.enum(["submit","approve","publish","archive","reopen"]), expectedRevision:z.number().int().min(1), note:z.string().trim().max(1000).optional() }).strict();
export const queryInput = z.object({ page:z.coerce.number().int().min(1).max(1000).default(1), limit:z.coerce.number().int().min(1).max(50).default(20), space:z.enum(spaces).optional(), type:z.string().regex(/^[a-z][a-z0-9_-]{1,49}$/).optional(), sort:z.enum(["updated","created","title"]).default("updated"), order:z.enum(["asc","desc"]).default("desc"), q:z.string().trim().max(100).optional(), status:z.enum(["draft","in_review","approved","published","archived"]).optional() }).strict();
export function parseQuery(url:string) { return queryInput.safeParse(Object.fromEntries(new URL(url).searchParams)); }
export function sameOrigin(request:Request):boolean {
  try { return Boolean(request.headers.get("origin")) && request.headers.get("origin") === new URL(process.env.BETTER_AUTH_URL || request.url).origin; }
  catch { return false; }
}
export async function readLimitedBody(request:Request,max:number):Promise<Uint8Array>{
  const len=Number(request.headers.get("content-length")||0);if(len>max)throw new Error("BODY_TOO_LARGE");
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error("BODY_TOO_LARGE")}chunks.push(value)}}finally{reader.releaseLock()}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}return result;
}
export async function bodyJson(request:Request):Promise<unknown>{return JSON.parse(new TextDecoder().decode(await readLimitedBody(request,32000)))}
export function failure(message:string,status:number) { return NextResponse.json({error:{message}},{status,headers:{"Cache-Control":"no-store"}}); }

