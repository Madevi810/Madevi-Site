import { z } from "zod";
const schema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["new", "in_progress", "resolved", "spam"]).optional()
}).strict();
export function parseAdminReportsQuery(url: string) {
  return schema.safeParse(Object.fromEntries(new URL(url).searchParams));
}
