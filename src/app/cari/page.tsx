import { PublicShell } from "@/components/public-shell";
import { queryInput } from "@/lib/api";
import { listContent } from "@/lib/content";
export const dynamic="force-dynamic";
export default async function SearchPage({ searchParams }: { searchParams: Promise<{q?: string}> }) {
  const {q:raw} = await searchParams; const q=(typeof raw==="string"?raw:"").trim().slice(0,100);
  if(!q) return <PublicShell page="search" query="" searchResults={[]}/>;
  try {
    const result=await listContent(queryInput.parse({q,limit:20}));
    const items=result.items.map((row:{id:string;space:string;slug:string;title:string})=>({id:row.id,space:row.space,slug:row.slug,title:row.title}));
    return <PublicShell page="search" query={q} searchResults={items}/>;
  } catch { return <PublicShell page="search" query={q} searchResults={[]} searchError/>; }
}
