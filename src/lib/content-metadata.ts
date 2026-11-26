import { z } from "zod";

export const webReference = z.url({ protocol: /^https?$/ }).max(2048).refine(value => {
  const url = new URL(value);
  return !url.username && !url.password;
});
export const editorialMetadata = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  description: z.string().trim().max(300).optional(),
  sources: z.array(z.object({ title: z.string().trim().min(1).max(140), url: webReference }).strict()).max(15).optional(),
  mediaIds: z.array(z.uuid()).max(12).optional(),
}).passthrough();

export function publishedMetadata(metadata: unknown) {
  const result = editorialMetadata.safeParse(metadata);
  if (!result.success) return {};
  const { category, tags, description, sources } = result.data;
  return { category, tags, description, sources };
}
