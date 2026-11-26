import { z } from "zod";
import { spaces, slug, failure } from "@/lib/api";
import { readPublishedContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{space:string;slug:string}>}) {
  const p = await params;
  if (!z.enum(spaces).safeParse(p.space).success || !slug.safeParse(p.slug).success) return failure("Tidak ditemukan",404);
  try {
    const content = await readPublishedContent(p.space,p.slug);
    return content ? Response.json(content,{headers:{"Cache-Control":"no-store"}}) : failure("Tidak ditemukan",404);
  } catch { return failure("Data belum tersedia",503); }
}
