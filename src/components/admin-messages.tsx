"use client";

import { useState } from "react";
import { AdminHeading, AdminLoading, AdminPageNav, adminJson, adminRequest, localDate, useAdminData, value, values } from "./admin-data";
import { AdminNotifications } from "./admin-notifications";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";

type Template={id:string;name:string;title:string;body:string};
type Job={
  id:string;title:string;body:string;audience:string;recipient_id:string|null;media_id:string|null;
  status:string;run_at:string|null;sent_at:string|null;deliveries:number|null;reads:number;attempts:number;updated_at:string;failure_code:string|null
};
const audiences:Record<string,string>={user:"Satu akun",verified:"Akun terverifikasi",unverified:"Akun belum terverifikasi",all:"Seluruh akun yang dapat mengakses"};
const statuses:Record<string,string>={draft:"Draf",scheduled:"Terjadwal",sent:"Terkirim",failed:"Gagal",cancelled:"Dibatalkan"};

export function AdminMessages() {
  const [page,setPage]=useState(1),[job,setJob]=useState<Job>(),[template,setTemplate]=useState<Template>();
  const [audience,setAudience]=useState("user"),[title,setTitle]=useState(""),[body,setBody]=useState("");
  const [draftId,setDraftId]=useState<string>(),[preview,setPreview]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState("");
  const list=useAdminData<{jobs:Job[];templates:Template[];hasNext:boolean}>(`/api/admin/messages?page=${page}`);
  async function apply(data:unknown,text:string,done?:()=>void) {
    setPending(true);setMessage("");
    try{
      const response=await adminRequest<{state?:string}>("/api/admin/messages",adminJson("POST",data));
      setMessage(response.state==="sent"?"Pesan terkirim.":response.state==="failed"?"Pengiriman gagal. Lihat riwayat untuk penyebab.":text);list.reload();done?.();
    }
    catch(error){setMessage((error as Error).message);}finally{setPending(false);}
  }
  function edit(row?:Job) {
    setJob(row);setDraftId(row?.id);setAudience(row?.audience??"user");setTitle(row?.title??"");setBody(row?.body??"");setPreview(false);
  }
  const sample=(text:string)=>text.replaceAll("{{nama}}","Pengguna Contoh").replaceAll("{{situs}}","Madevi");
  return <><AdminHeading description="Kirim notifikasi di dalam website. Pengiriman email massal belum tersedia.">Notifikasi & Pesan</AdminHeading>
  {message&&<p role="status" className={statusMessage}>{message}</p>}
  <section className={adminPanel}><h2>{job?"Ubah draf":"Buat draf pesan"}</h2>
    <p>Variabel yang tersedia adalah <code>{"{{nama}}"}</code> dan <code>{"{{situs}}"}</code>.</p>
    <form className="grid gap-3" key={job?.id??"new"} onSubmit={e=>{
      e.preventDefault();const form=e.currentTarget,data=values(form);
      const id=draftId??crypto.randomUUID();setDraftId(id);
      void apply({action:"draft",id,title,body,audience,recipientId:audience==="user"?value(data,"recipient"):undefined,mediaId:value(data,"media")||undefined,expectedUpdated:job?.updated_at},"Draf tersimpan.",()=>{form.reset();edit();setPage(1);});
    }}>
      <label className={fieldLabel}>Pakai template<select className={inputControl} defaultValue="" onChange={e=>{const item=list.data?.templates.find(x=>x.id===e.target.value);if(item){setTitle(item.title);setBody(item.body);}}}><option value="">Pilih template</option>{list.data?.templates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={fieldLabel}>Tujuan<select className={inputControl} value={audience} onChange={e=>setAudience(e.target.value)}>{Object.entries(audiences).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {audience==="user"&&<label className={fieldLabel}>ID akun<input className={inputControl} name="recipient" defaultValue={job?.recipient_id??""} maxLength={128} required/></label>}
      <label className={fieldLabel}>Judul pesan<input className={inputControl} value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required/></label>
      <label className={fieldLabel}>Isi pesan<textarea className={textAreaControl} value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} required/></label>
      <label className={fieldLabel}>ID gambar dari pustaka, opsional<input className={inputControl} name="media" defaultValue={job?.media_id??""} maxLength={36}/></label>
      <button className={textButton} type="button" onClick={()=>setPreview(!preview)} aria-expanded={preview}>Pratinjau</button>
      {preview&&<div className="rounded-lg border border-madevi-line p-4"><strong>{sample(title)||"Judul belum diisi"}</strong><p className="whitespace-pre-wrap">{sample(body)||"Isi belum diisi"}</p></div>}
      <button className={primaryButton} disabled={pending}>Simpan draf pesan</button>
      {job&&<button className={textButton} type="button" onClick={()=>edit()}>Batal edit</button>}
    </form>
  </section>
  {!list.data?<AdminLoading error={list.error}/>:<>
  <section className={adminPanel}><h2>Antrean dan riwayat pengiriman</h2>
    {list.data.jobs.length?list.data.jobs.map(row=><article key={row.id} className="my-3 border-b border-madevi-line pb-3">
      <h3>{row.title}</h3><p>{statuses[row.status]} · {audiences[row.audience]}{row.recipient_id&&` · ${row.recipient_id}`}</p>
      <p>{row.run_at&&`Jadwal ${localDate(row.run_at)} · `}{row.sent_at&&`Terkirim ${localDate(row.sent_at)} · `}{row.deliveries!==null&&`${row.reads} dibaca dari ${row.deliveries} · `}{row.attempts} percobaan</p>
      {row.failure_code&&row.status==="failed"&&<p role="status">{row.failure_code==="no_recipients"?"Tidak ada penerima yang memenuhi syarat.":"Database gagal menyimpan pengiriman."}</p>}
      <details><summary>Lihat isi</summary><p className="whitespace-pre-wrap">{row.body}</p>{row.media_id&&<a href={`/api/media/${row.media_id}`}>Lihat lampiran</a>}</details>
      {row.status==="draft"&&<><button className={textButton} onClick={()=>edit(row)}>Ubah draf</button>
      <form className="grid gap-2" onSubmit={e=>{
        e.preventDefault();if(!window.confirm("Antrekan pengiriman kepada penerima yang dipilih?"))return;
        const time=value(values(e.currentTarget),"runAt");
        void apply({action:"queue",id:row.id,runAt:time?new Date(time).toISOString():undefined},"Pesan masuk antrean. Pekerja pengiriman akan mengambilnya saat jatuh tempo.");
      }}><label className={fieldLabel}>Jadwal waktu lokal, kosong untuk antrekan berikutnya<input className={inputControl} name="runAt" type="datetime-local"/></label><button className={primaryButton} disabled={pending}>Antrekan pengiriman</button></form></>}
      {row.status==="failed"&&row.attempts<5&&<button className={textButton} disabled={pending} onClick={()=>void apply({action:"retry",id:row.id},"Percobaan ulang masuk antrean.")}>Coba lagi</button>}
      {["draft","scheduled","failed"].includes(row.status)&&<button className={textButton} disabled={pending} onClick={()=>{if(window.confirm("Batalkan pesan ini?"))void apply({action:"cancel",id:row.id},"Pesan dibatalkan.");}}>Batalkan pesan</button>}
    </article>):<p>Belum ada pesan.</p>}
    <AdminPageNav page={page} next={list.data.hasNext} move={setPage}/>
  </section>
  <section className={adminPanel}><h2>Template pesan</h2>
    <form className="grid gap-3" key={template?.id??"new"} onSubmit={e=>{
      e.preventDefault();const form=e.currentTarget,data=values(form);
      void apply({action:"template",id:template?.id??crypto.randomUUID(),name:value(data,"name"),title:value(data,"title"),body:value(data,"body")},"Template tersimpan.",()=>{setTemplate(undefined);form.reset();});
    }}><label className={fieldLabel}>Nama template<input className={inputControl} name="name" maxLength={100} defaultValue={template?.name} required/></label>
      <label className={fieldLabel}>Judul template<input className={inputControl} name="title" maxLength={160} defaultValue={template?.title} required/></label>
      <label className={fieldLabel}>Isi template<textarea className={textAreaControl} name="body" maxLength={2000} defaultValue={template?.body} required/></label>
      <button className={primaryButton} disabled={pending}>Simpan template</button>{template&&<button className={textButton} type="button" onClick={()=>setTemplate(undefined)}>Batal edit</button>}
    </form>
    {list.data.templates.map(item=><div className="border-b border-madevi-line py-3" key={item.id}><strong>{item.name}</strong><button className={textButton} onClick={()=>setTemplate(item)}>Ubah template</button><button className={textButton} disabled={pending} onClick={()=>{if(window.confirm("Hapus template ini?"))void apply({action:"removeTemplate",id:item.id},"Template dihapus.");}}>Hapus template</button></div>)}
  </section>
  </>}
  <details className={adminPanel}><summary>Pengumuman umum untuk pengunjung</summary><AdminNotifications/></details>
  </>;
}
