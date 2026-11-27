"use client";

import { useRef, useState } from "react";
import { AdminRequestError, AdminHeading, AdminLoading, AdminPageNav, adminJson, adminRequest, localDate, splitLines, useAdminData, value, values } from "./admin-data";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";

type Site={version:number;announcement:string;navigation:{label:string;href:string}[]};
type Info={slug:string;title:string;body:string;visible:boolean;version:number};
type SiteHistoryRow={version:number;actor_id:string|null;snapshot:Record<string,unknown>;created_at:string;restored_from:number|null};
function SiteHistory({resource,current,onChange}:{resource:string;current:Site|Info;onChange:()=>void}) {
  const [open,setOpen]=useState(false),[before,setBefore]=useState<number>(),[selected,select]=useState<SiteHistoryRow>();
  const [pending,setPending]=useState(false),[message,setMessage]=useState("");
  const history=useAdminData<{history:SiteHistoryRow[];next:number|null}>(open?`/api/admin/site?resource=${resource}${before?`&before=${before}`:""}`:"");
  const [confirm,setConfirm]=useState(false);
  const active:Record<string,unknown>={...current};
  const changed=selected?Object.keys(selected.snapshot).filter(key=>key!=="slug"&&JSON.stringify(selected.snapshot[key])!==JSON.stringify(active[key])):[];
  const labels:Record<string,string>={title:"Judul",body:"Isi teks",visible:"Visibilitas",navigation:"Tautan footer",announcement:"Pengumuman"};
  const show=(value:unknown)=>typeof value==="string"?value||"(kosong)":JSON.stringify(value,null,2);
  return <details className="mt-4" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>Riwayat versi dan pemulihan</summary>
    {!history.data?<p role={history.error?"alert":"status"}>{history.error??"Memuat riwayat…"}</p>:<>
      {history.data.history.length?<ul>{history.data.history.map(row=><li className="my-2" key={row.version}>
        Versi {row.version} · {localDate(row.created_at)} · {row.actor_id??"Versi awal"}{row.restored_from!==null&&` · Dari v${row.restored_from}`}
        {row.version<current.version&&<button className={textButton} onClick={()=>{select(row);setConfirm(false);setMessage("");}}>Bandingkan versi {row.version}</button>}
      </li>)}</ul>:<p>Belum ada perubahan yang tercatat.</p>}
      {before!==undefined&&<button className={textButton} onClick={()=>setBefore(undefined)}>Riwayat terbaru</button>}
      {history.data.next!==null&&<button className={textButton} onClick={()=>setBefore(history.data?.next??undefined)}>Riwayat lebih lama</button>}
    </>}
    {selected&&<section aria-label="Perbandingan versi"><h3>Versi aktif {current.version} dibanding versi {selected.version}</h3>
      {changed.length?changed.map(key=><div key={key} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div><strong>{labels[key]} saat ini</strong><pre className="whitespace-pre-wrap break-words">{show(active[key])}</pre></div>
        <div><strong>{labels[key]} yang akan dipulihkan</strong><pre className="whitespace-pre-wrap break-words">{show(selected.snapshot[key])}</pre></div>
      </div>):<p>Isi snapshot sama dengan versi aktif.</p>}
      <label><input type="checkbox" checked={confirm} onChange={event=>setConfirm(event.target.checked)}/> Simpan snapshot lama sebagai versi baru</label>
      <button className={textButton} type="button" disabled={!confirm||pending} onClick={async()=>{
        setPending(true);
        try {await adminRequest("/api/admin/site",adminJson("POST",{resource,expectedVersion:current.version,version:selected.version}));select(undefined);setMessage("Snapshot disimpan sebagai versi baru.");history.reload();onChange();}
        catch(error){setMessage((error as Error).message);}finally{setPending(false);}
      }}>Pulihkan pengaturan</button>
    </section>}
    {message&&<p role="status" className={statusMessage}>{message}</p>}
  </details>;
}
export function AdminSite({mode}:{mode:"pages"|"settings"}) {
  const {data,error,reload}=useAdminData<{settings:Site;pages:Info[]}>("/api/admin/site");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function save(body:unknown) {
    setBusy(true);setMessage("");
    try {await adminRequest("/api/admin/site",adminJson("PUT",body));reload();setMessage("Perubahan tersimpan.");}
    catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  }
  return <><AdminHeading>{mode==="pages"?"Halaman & Navigasi":"Pengaturan Website"}</AdminHeading>
    {message&&<p role="status" className={statusMessage}>{message}</p>}
    {!data?<AdminLoading error={error}/>:<>
    {mode==="pages"&&data.pages.map(info=><section className={adminPanel} key={info.slug}>
      <h2>{info.title}</h2>{info.visible&&<p><a href={`/info/${info.slug}`}>Buka halaman publik</a></p>}
      <form className="grid gap-3" key={info.version} onSubmit={e=>{e.preventDefault();const form=values(e.currentTarget);void save({slug:info.slug,title:value(form,"title"),body:value(form,"body"),visible:form.has("visible"),expectedVersion:info.version});}}>
      <label className={fieldLabel}>Judul<input name="title" className={inputControl} defaultValue={info.title} maxLength={160} required/></label>
      <label className={fieldLabel}>Isi teks<textarea name="body" className={textAreaControl} defaultValue={info.body} rows={4} maxLength={12000}/></label>
      <label><input name="visible" type="checkbox" defaultChecked={info.visible}/> Tampilkan ke publik</label>
      <button className={primaryButton} disabled={busy}>Simpan halaman</button>
      </form>
      <SiteHistory resource={info.slug} current={info} onChange={reload}/>
    </section>)}
    <section className={adminPanel}>
      <h2>{mode==="pages"?"Tautan footer":"Pengumuman website"}</h2>
      <form className="grid gap-3" key={data.settings.version} onSubmit={e=>{
        e.preventDefault();const form=values(e.currentTarget);
        const links=mode==="pages"?splitLines(value(form,"navigation")).map(line=>{const [label,href]=line.split(" | ");return {label,href};}):data.settings.navigation;
        void save({navigation:links,announcement:mode==="settings"?value(form,"announcement"):data.settings.announcement,expectedVersion:data.settings.version});
      }}>
      {mode==="pages"?<label className={fieldLabel}>Satu tautan per baris. Contoh Bantuan | /info/bantuan<textarea className={textAreaControl} name="navigation" rows={5} defaultValue={data.settings.navigation.map(item=>`${item.label} | ${item.href}`).join("\n")}/></label>:<label className={fieldLabel}>Teks pengumuman, kosong untuk menyembunyikan<input className={inputControl} name="announcement" maxLength={200} defaultValue={data.settings.announcement}/></label>}
      <button className={primaryButton} disabled={busy}>Simpan pengaturan</button>
      </form>
      <SiteHistory resource="settings" current={data.settings} onChange={reload}/>
    </section></>}
  </>;
}

type ImageRecord={id:string;name:string;mime_type:string;visibility:string;publication_reviewed_at:string|null;bytes:number;linked:boolean};
export function AdminMedia() {
  const [page,setPage]=useState(1),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(false);
  const attempt=useRef<FormData|null>(null), uploading=useRef(false);
  const list=useAdminData<{items:ImageRecord[];next:boolean}>(`/api/admin/media?page=${page}`);
  async function approvePublication(item:ImageRecord) {
    if(busy||!window.confirm("Sumber dan isi dokumen telah diperiksa secara manual dan dokumen boleh dipublikasikan?"))return;
    setBusy(true);setMessage("");
    try {
      await adminRequest("/api/admin/media",adminJson("PATCH",{id:item.id,publicationChecked:true}));
      list.reload();setMessage("Tinjauan publikasi dicatat.");
    } catch(error){setMessage((error as Error).message);}
    finally{setBusy(false);}
  }
  async function remove(item:ImageRecord) {
    if(!window.confirm(`Hapus berkas ${item.name}?`))return;
    setBusy(true);setMessage("");
    try {await adminRequest("/api/admin/media",adminJson("DELETE",{id:item.id}));list.reload();setMessage("Berkas dihapus.");}
    catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  }
  return <><AdminHeading description="JPEG, PNG, WebP, PDF, TXT, atau CSV. Maksimal 2 MB per file, total pustaka 256 MB.">Media & Berkas</AdminHeading>
  <section className={adminPanel}><h2>Unggah berkas</h2>
    <form className="grid gap-3" onSubmit={async e=>{
      e.preventDefault();if(uploading.current||busy)return;
      const form=e.currentTarget;
      if(!attempt.current) {
        attempt.current=values(form);
        attempt.current.set("id",crypto.randomUUID());
      }
      uploading.current=true;setBusy(true);setMessage("");
      try {
        const result=await adminRequest<{id:string}>("/api/admin/media",{method:"POST",body:attempt.current});
        attempt.current=null;setRetry(false);form.reset();setPage(1);list.reload();setMessage(`Berkas tersimpan. ID ${result.id}`);
      } catch(error) {
        const uncertain=error instanceof AdminRequestError&&(error.uncertain||retry&&error.status===429);
        if(!uncertain)attempt.current=null;
        setRetry(uncertain);setMessage((error as Error).message);
      } finally {uploading.current=false;setBusy(false);}
    }}>
      <label className={fieldLabel}>Nama<input className={inputControl} name="name" disabled={busy||retry} required maxLength={120}/></label>
      <label className={fieldLabel}>Visibilitas<select className={inputControl} name="visibility" disabled={busy||retry}><option value="private">Privat, untuk admin atau penerima pesan</option><option value="public">Publik saat revisi terkait diterbitkan</option></select></label>
      <label className={fieldLabel}>Berkas<input className={inputControl} name="file" disabled={busy||retry} type="file" accept="image/jpeg,image/png,image/webp,.pdf,.txt,.csv" required/></label>
      <label><input type="checkbox" name="publicationChecked" disabled={busy||retry}/> Untuk dokumen publik, saya telah memeriksa sumber dan isi berkas secara manual.</label>
      <button className={primaryButton} disabled={busy}>{retry?"Periksa dengan coba kembali":"Unggah berkas"}</button>
    </form>{message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>
  {!list.data?<AdminLoading error={list.error}/>:<section className={adminPanel}><h2>Pustaka berkas</h2>
    {list.data.items.length?list.data.items.map(item=><div key={item.id} className="border-b border-madevi-line py-3">
      <a href={`/api/media/${item.id}`}>{item.name}</a><p>{item.visibility==="public"?"Publik saat ditautkan":"Privat"} · {item.mime_type} · {item.bytes} byte · {item.linked?"Dipakai pada revisi atau pesan":"Belum dipakai"}</p>
      <label className={fieldLabel}>ID lampiran<input className={inputControl} readOnly value={item.id} onFocus={e=>e.currentTarget.select()}/></label>
      {item.visibility==="public"&&item.mime_type!=="image/webp"&&!item.publication_reviewed_at&&
        <button className={textButton} disabled={busy||retry} onClick={()=>void approvePublication(item)}>Catat tinjauan publikasi</button>}
      {!item.linked&&<button className={textButton} disabled={busy||retry} onClick={()=>void remove(item)}>Hapus berkas</button>}
    </div>):<p>Belum ada berkas di halaman ini.</p>}
    <AdminPageNav page={page} next={list.data.next} move={setPage}/>
  </section>}</>;
}
