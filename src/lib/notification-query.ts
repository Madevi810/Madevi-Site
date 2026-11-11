import { z } from "zod";

const cursorSchema = z.object({
  time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/).refine(value => {const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,19)===value.slice(0,19)}),
  id: z.uuid()
}).strict();
const querySchema = z.object({
  category: z.enum(["general", "system", "social"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional()
}).strict();
export function encodeNotificationCursor(cursor: {time:string;id:string}): string {
  return Buffer.from(JSON.stringify(cursorSchema.parse(cursor))).toString("base64url");
}
export function parseNotificationQuery(url:string) {
  const raw=querySchema.safeParse(Object.fromEntries(new URL(url).searchParams));
  if (!raw.success) return {success:false as const};
  let after: z.infer<typeof cursorSchema> | null = null;
  if(raw.data.cursor){
    try { const parsed=cursorSchema.safeParse(JSON.parse(Buffer.from(raw.data.cursor,"base64url").toString("utf8"))); if(!parsed.success)return {success:false as const};after=parsed.data; }
    catch {return {success:false as const};}
  }
  return {success:true as const,data:{category:raw.data.category,limit:raw.data.limit,after}};
}
