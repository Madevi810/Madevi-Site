"use client";

import { useState } from "react";
import { AdminHeading, AdminLoading, AdminPageNav, adminJson, adminRequest, splitLines, useAdminData, value, values } from "./admin-data";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";

type Site={version:number;announcement:string;navigation:{label:string;href:string}[]};
type Info={slug:string;title:string;body:string;visible:boolean;version:number};
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
    </section></>}
  </>;
}

type ImageRecord={id:string;name:string;visibility:string;bytes:number;linked:boolean};
export function AdminMedia() {
  const [page,setPage]=useState(1),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const list=useAdminData<{items:ImageRecord[];next:boolean}>(`/api/admin/media?page=${page}`);
  async function remove(item:ImageRecord) {
    if(!window.confirm(`Hapus gambar ${item.name}?`))return;
    setBusy(true);setMessage("");
    try {await adminRequest("/api/admin/media",adminJson("DELETE",{id:item.id}));list.reload();setMessage("Gambar dihapus.");}
    catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  }
  return <><AdminHeading description="JPEG, PNG, atau WebP sampai 2 MB. Server menyimpan hasil sebagai WebP.">Media & Berkas</AdminHeading>
  <section className={adminPanel}><h2>Unggah gambar</h2>
    <form className="grid gap-3" onSubmit={async e=>{
      e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage("");
      try {const result=await adminRequest<{id:string}>("/api/admin/media",{method:"POST",body:values(form)});form.reset();setPage(1);list.reload();setMessage(`Gambar tersimpan. ID ${result.id}`);}
      catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
    }}>
      <label className={fieldLabel}>Nama<input className={inputControl} name="name" required maxLength={120}/></label>
      <label className={fieldLabel}>Visibilitas<select className={inputControl} name="visibility"><option value="private">Privat, untuk admin atau penerima pesan</option><option value="public">Publik saat revisi terkait diterbitkan</option></select></label>
      <label className={fieldLabel}>Berkas<input className={inputControl} name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
      <button className={primaryButton} disabled={busy}>Unggah gambar</button>
    </form>{message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>
  {!list.data?<AdminLoading error={list.error}/>:<section className={adminPanel}><h2>Pustaka gambar</h2>
    {list.data.items.length?list.data.items.map(item=><div key={item.id} className="border-b border-madevi-line py-3">
      <a href={`/api/media/${item.id}`}>{item.name}</a><p>{item.visibility==="public"?"Publik saat ditautkan":"Privat"} · {item.bytes} byte · {item.linked?"Dipakai pada revisi atau pesan":"Belum dipakai"}</p>
      <label className={fieldLabel}>ID lampiran<input className={inputControl} readOnly value={item.id} onFocus={e=>e.currentTarget.select()}/></label>
      {!item.linked&&<button className={textButton} disabled={busy} onClick={()=>void remove(item)}>Hapus gambar</button>}
    </div>):<p>Belum ada gambar di halaman ini.</p>}
    <AdminPageNav page={page} next={list.data.next} move={setPage}/>
  </section>}</>;
}
