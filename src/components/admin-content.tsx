"use client";

import { useEffect, useState } from "react";
import { adminJson, adminRequest, localDate, splitLines, useAdminData } from "./admin-data";
import { rooms } from "@/lib/rooms";
import { adminTitle, adminPanel, userRow, fieldLabel, inputControl, textAreaControl, formLayout, statusMessage, primaryButton, outlineButton, textButton } from "./styles";
type Item = {
  id: string;
  space: string;
  type: string;
  slug: string;
  title: string;
  workflow_status: string;
  latest_revision: number;
  deleted_at: string | null;
  body: {
    blocks?: unknown;
  };
  metadata: Record<string, unknown>;
};
type ResponseData = {
  items?: Item[];
  total?: number;
  error?: {
    message?: string;
  };
};
export function AdminContent({room}: {room?:string}) {
  const [filter, setFilter] = useState({q:"",category:"",tag:"",status:"",sort:"updated",order:"desc"});
  const [category,setCategory]=useState(""),[tags,setTags]=useState(""),[description,setDescription]=useState("");
  const [sources,setSources]=useState(""),[media,setMedia]=useState("");
  const [history,setHistory]=useState<Item|null>(null),[before,setBefore]=useState<number>(),[selected,setSelected]=useState<number>();
  const revisions=useAdminData<{items:{revision:number;title:string;created_at:string}[];next:number|null}>(history?`/api/admin/content/${history.id}/revisions${before?`?before=${before}`:""}`:"");
  const preview=useAdminData<{revision:{title:string;body:{blocks?:unknown[]};metadata:Record<string,unknown>}}>(history&&selected?`/api/admin/content/${history.id}?revision=${selected}`:"");
  function setOption(key:keyof typeof filter,value:string) {
    setFilter(previous=>({...previous,[key]:value}));setPage(1);
  }
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [space, setSpace] = useState(room??"explore");
  const [type, setType] = useState("article");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const query=new URLSearchParams({limit:"25",page:String(page),trash:filter.status==="trash"?"only":"active"});
      if(room)query.set("space",room);
      for(const [key,value] of Object.entries(filter))if(value&&!(key==="status"&&value==="trash"))query.set(key,value);
      const r = await fetch(`/api/admin/content?${query}`, {cache:"no-store", signal});
      const data: ResponseData = await r.json();
      if (!r.ok) throw Error(data.error?.message || "Data tidak tersedia.");
      if (!signal?.aborted) { setItems(data.items || []);setTotal(data.total || 0); }
    } catch { if (!signal?.aborted) { setItems([]);setTotal(0);setMessage("Daftar konten belum tersedia."); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [page,filter,room]);
  function reset() {
    setEdit(null);
    setSpace(room??"explore");
    setType("article");
    setSlug("");
    setTitle("");
    setBody("");setCategory("");setTags("");setDescription("");setSources("");setMedia("");
  }
  function start(row: Item) {
    if (!row.body || Object.keys(row.body).some(k => k !== "blocks") || !Array.isArray(row.body.blocks) || !row.body.blocks.every(x => typeof x === "string")) {
      setMessage("Format materi ini belum dapat diubah melalui formulir teks.");
      return;
    }
    setEdit(row);
    setSpace(row.space);
    setType(row.type);
    setSlug(row.slug);
    setTitle(row.title);
    setBody(row.body.blocks.join("\n\n"));
    setCategory(typeof row.metadata.category==="string"?row.metadata.category:"");
    setTags(Array.isArray(row.metadata.tags)?row.metadata.tags.join(", "):"");
    setDescription(typeof row.metadata.description==="string"?row.metadata.description:"");
    setSources(Array.isArray(row.metadata.sources)?row.metadata.sources.map(link=>`${link.title} | ${link.url}`).join("\n"):"");
    setMedia(Array.isArray(row.metadata.mediaIds)?row.metadata.mediaIds.join("\n"):"");
    setMessage("");
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    const blocks = body.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
    const metadata={...edit?.metadata,category:category.trim()||undefined,tags:tags.split(",").map(x=>x.trim()).filter(Boolean),
      description,sources:splitLines(sources).map(line=>{const [title,url]=line.split(" | ");return {title,url};}),mediaIds:splitLines(media)};
    const data = edit ? {
      title,
      body: {
        blocks
      },
      metadata,
      expectedRevision: edit.latest_revision
    } : {
      space,
      type,
      slug,
      title,
      body: {
        blocks
      },
      metadata
    };
    try {
      const response = await fetch(edit ? `/api/admin/content/${edit.id}` : "/api/admin/content", {
        method: edit ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || "Konten tidak tersimpan.");
      reset();
      setMessage("Draf tersimpan.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Konten tidak tersimpan.");
    } finally {
      setPending(false);
    }
  }
  async function trash(row: Item, action: "trash" | "restore") {
    if (action === "trash" && !window.confirm("Pindahkan konten yang diarsipkan ke tempat sampah?")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/content/${row.id}/trash`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action,
          expectedRevision: row.latest_revision
        })
      });
      if (!response.ok) throw Error("Konten belum dapat diproses.");
      setMessage(action === "trash" ? "Konten dipindahkan ke tempat sampah." : "Konten dipulihkan ke arsip.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setPending(false);
    }
  }
  async function transition(row: Item, action: string) {
    if (action === "archive" && !window.confirm("Arsipkan konten ini?")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/content/${row.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action,
          expectedRevision: row.latest_revision
        })
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || "Status tidak berubah.");
      setMessage("Status diperbarui.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Status tidak berubah.");
    } finally {
      setPending(false);
    }
  }
  async function copy() {
    if(!history||!selected)return;
    const slug=window.prompt("Slug draf salinan");
    if(!slug)return;
    await applyRevision({revision:selected,slug});
  }
  async function applyRevision(payload:unknown) {
    if(!history)return;
    setPending(true);
    try {
      await adminRequest(`/api/admin/content/${history.id}/revisions`,adminJson("POST",payload));
      setMessage("Draf tersimpan.");setHistory(null);await load();
    } catch(error){setMessage((error as Error).message);}
    finally{setPending(false);}
  }
  return <><div className={adminTitle}><div><h1>{room?rooms.find(item=>item.slug===room)?.name:"Konten"}</h1><p>Kelola draf dan penerbitan Madevi.</p></div></div>{message && <p className={statusMessage} role="status">{message}</p>}<section className={adminPanel}><h2>{edit ? "Ubah draf" : "Buat draf"}</h2><form className={formLayout} onSubmit={save}><label className={fieldLabel}>Ruang<select className="h-madevi-46 w-full rounded-madevi-12 border border-madevi-line bg-madevi-surface px-madevi-14 text-madevi-text" value={space} onChange={e => setSpace(e.target.value)} disabled={Boolean(edit)||Boolean(room)}>{rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></label><label className={fieldLabel}>Jenis<input className={inputControl} value={type} onChange={e => setType(e.target.value)} pattern="[a-z][a-z0-9_-]{1,49}" disabled={Boolean(edit)} required /></label><label className={fieldLabel}>Slug<input className={inputControl} value={slug} onChange={e => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={Boolean(edit)} required /></label><label className={fieldLabel}>Judul<input className={inputControl} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><label className={fieldLabel}>Materi teks<textarea className={textAreaControl} rows={6} value={body} onChange={e => setBody(e.target.value)} /></label><label className={fieldLabel}>Kategori<input className={inputControl} value={category} onChange={e=>setCategory(e.target.value)} maxLength={80}/></label>
  <label className={fieldLabel}>Tag, pisahkan dengan koma<input className={inputControl} value={tags} onChange={e=>setTags(e.target.value)}/></label>
  <label className={fieldLabel}>Ringkasan<textarea className={textAreaControl} value={description} onChange={e=>setDescription(e.target.value)} maxLength={300}/></label>
  <label className={fieldLabel}>Rujukan, satu per baris dengan format Judul | https://contoh.invalid<textarea className={textAreaControl} value={sources} onChange={e=>setSources(e.target.value)}/></label>
  <label className={fieldLabel}>ID media publik, satu per baris<textarea className={textAreaControl} value={media} onChange={e=>setMedia(e.target.value)}/></label>
  <button className={primaryButton} disabled={pending}>{edit ? "Simpan revisi" : "Simpan draf"}</button>{edit && <button type="button" className={textButton} onClick={reset}>Batal</button>}</form></section><section className={adminPanel}><h2>Daftar konten</h2>
  <div className="grid gap-3 sm:grid-cols-2">
    <label className={fieldLabel}>Cari konten<input className={inputControl} value={filter.q} onChange={e=>setOption("q",e.target.value)} maxLength={100}/></label>
    <label className={fieldLabel}>Filter kategori<input className={inputControl} value={filter.category} onChange={e=>setOption("category",e.target.value)} maxLength={80}/></label>
    <label className={fieldLabel}>Filter tag<input className={inputControl} value={filter.tag} onChange={e=>setOption("tag",e.target.value)} maxLength={60}/></label>
    <label className={fieldLabel}>Status<select className={inputControl} value={filter.status} onChange={e=>setOption("status",e.target.value)}><option value="">Semua yang aktif atau diarsipkan</option><option value="draft">Draf</option><option value="in_review">Ditinjau</option><option value="approved">Disetujui</option><option value="published">Terbit</option><option value="archived">Arsip</option><option value="trash">Tempat sampah</option></select></label>
    <label className={fieldLabel}>Urutkan<select className={inputControl} value={filter.sort} onChange={e=>setOption("sort",e.target.value)}><option value="updated">Waktu diperbarui</option><option value="created">Waktu dibuat</option><option value="title">Judul</option></select></label>
    <label className={fieldLabel}>Arah urut<select className={inputControl} value={filter.order} onChange={e=>setOption("order",e.target.value)}><option value="desc">Menurun</option><option value="asc">Menaik</option></select></label>
  </div>{items.length ? items.map(row => <div className={userRow} key={row.id}><div><strong>{row.title}</strong><p>{row.space} · {row.deleted_at ? "tempat sampah" : row.workflow_status} · revisi {row.latest_revision}</p></div><div>{!row.deleted_at&&<button className={textButton} onClick={()=>{setHistory(row);setSelected(row.latest_revision);setBefore(undefined);}}>Revisi dan pratinjau</button>}{row.deleted_at ? <button className={textButton} disabled={pending} onClick={() => void trash(row, "restore")}>Pulihkan ke arsip</button> : <>{["draft", "published"].includes(row.workflow_status) && <button className={outlineButton} disabled={pending} onClick={() => start(row)}>Ubah</button>}{row.workflow_status === "draft" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "submit")}>Ajukan</button>}{row.workflow_status === "in_review" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "approve")}>Setujui</button>}{row.workflow_status === "approved" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "publish")}>Terbitkan</button>}{row.workflow_status !== "archived" ? <button className={textButton} disabled={pending} onClick={() => void transition(row, "archive")}>Arsipkan</button> : <><button className={textButton} disabled={pending} onClick={() => void transition(row, "reopen")}>Buka lagi</button><button className={textButton} disabled={pending} onClick={() => void trash(row, "trash")}>Hapus</button></>}</>}</div></div>) : <p className="text-madevi-muted">{loading ? "Memuat konten…" : "Belum ada konten."}</p>}<div className="mt-madevi-12 flex items-center gap-madevi-12" aria-label="Halaman konten"><button className={textButton} type="button" disabled={page === 1 || loading || pending} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">Halaman {page}</span><button className={textButton} type="button" disabled={page * 25 >= total || loading || pending} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></section>
  {history&&<section className={adminPanel}><h2>Revisi dan pratinjau {history.title}</h2>
    <button className={textButton} onClick={()=>setHistory(null)}>Tutup riwayat</button>
    {revisions.error?<p role="alert">{revisions.error}</p>:revisions.data?<><ul>{revisions.data.items.map(r=><li key={r.revision}><button aria-pressed={selected===r.revision} className={textButton} onClick={()=>setSelected(r.revision)}>Revisi {r.revision} · {r.title} · {localDate(r.created_at)}</button></li>)}</ul>
    {revisions.data.next&&<button className={textButton} onClick={()=>setBefore(revisions.data?.next??undefined)}>Revisi lebih lama</button>}{before&&<button className={textButton} onClick={()=>setBefore(undefined)}>Kembali ke terbaru</button>}</>:<p role="status">Memuat revisi…</p>}
    {preview.error?<p role="alert">{preview.error}</p>:preview.data&&<article className="my-4 rounded-lg border border-madevi-line p-4"><h3>{preview.data.revision.title}</h3>
    {preview.data.revision.body.blocks?.map((block,i)=><p className="whitespace-pre-wrap" key={i}>{typeof block==="string"?block:typeof block==="object"&&block&&"text" in block?String(block.text):""}</p>)}
    {Array.isArray(preview.data.revision.metadata.mediaIds)&&preview.data.revision.metadata.mediaIds.map((id:string,i:number)=><p key={i}><a href={`/api/media/${id}`}>Lihat lampiran {i+1}</a></p>)}
    <button className={textButton} disabled={pending} onClick={()=>void copy()}>Gandakan sebagai draf</button>
    {selected!==history.latest_revision&&["draft","published"].includes(history.workflow_status)&&<button className={textButton} disabled={pending} onClick={()=>{if(window.confirm("Jadikan revisi ini draf baru?"))void applyRevision({revision:selected,expectedRevision:history.latest_revision});}}>Pulihkan sebagai draf</button>}
    </article>}
  </section>}
  </>;
}
