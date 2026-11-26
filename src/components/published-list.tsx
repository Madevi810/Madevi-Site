import Link from "next/link";
import { queryInput } from "@/lib/api";
import { listContent } from "@/lib/content";
import { inputControl, primaryButton, roomPill } from "./styles";

export async function PublishedList({path,space,params}:{path:string;space?:string;params:Record<string,unknown>}) {
  const page = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const q = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const category = typeof params.category === "string" ? params.category.trim().slice(0,80) : "";
  const tag = typeof params.tag === "string" ? params.tag.trim().slice(0,60) : "";
  const query = queryInput.parse({space,page:Math.min(1000,Math.max(1,page)),q,category:category||undefined,tag:tag||undefined,limit:20});
  const href = (number:number) => `${path}?${new URLSearchParams({q,category,tag,page:String(number)})}`;
  const data = await listContent(query).catch(()=>null);
  return <>
    <form action={path} className="flex flex-wrap items-end gap-3 my-5">
      <label>Cari judul<input className={inputControl} name="q" defaultValue={q} maxLength={100}/></label>
      <label>Kategori<input className={inputControl} name="category" defaultValue={category} maxLength={80}/></label>
      <label>Tag<input className={inputControl} name="tag" defaultValue={tag} maxLength={60}/></label>
      <button className={primaryButton}>Terapkan filter</button>
    </form>
    {!data ? <p role="alert">Konten sementara tidak dapat dimuat.</p> : <>
      {data.items.length ? <ul className="list-none p-0 space-y-3">{data.items.map(item=><li key={item.id}>
        <Link className={roomPill} href={`/baca/${item.space}/${item.slug}`}>{item.title}{item.metadata.category && ` · ${item.metadata.category}`}</Link>
      </li>)}</ul> : <p>{q || category || tag ? "Tidak ada konten yang cocok." : "Belum ada konten terbit."}</p>}
      <nav className="flex gap-4 items-center my-5" aria-label="Navigasi halaman hasil">
        {query.page>1 && <Link href={href(query.page-1)}>Sebelumnya</Link>}
        <span>Halaman {query.page} · {data.total} konten</span>
        {query.page<1000 && query.page*query.limit<data.total && <Link href={href(query.page+1)}>Berikutnya</Link>}
      </nav>
    </>}
  </>;
}
