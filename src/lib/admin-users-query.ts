import { z } from "zod";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(100).default("")
}).strict();

export function parseAdminUsersQuery(url: string) {
  return schema.safeParse(Object.fromEntries(new URL(url).searchParams));
}
