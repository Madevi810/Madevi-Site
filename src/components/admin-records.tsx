"use client";

import { useState } from "react";
import { rooms } from "@/lib/rooms";
import { AdminHeading, AdminLoading, AdminPageNav, adminJson, adminRequest, dateInput, localDate, useAdminData, value, values } from "./admin-data";
import { OperationsMonitoring } from "./operations-monitoring";
import { SupportAvailability, SupportInbox } from "./support-inbox";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";

type Count={status:string;count:number};
type Audit={action:string;actor_id:string;target_id:string;reason?:string;outcome:string;created_at:string};
type Summary={
  users:Count[];reports:Count[];content:(Count&{space:string;visible:number})[];
  audit:Audit[];usage:{database_bytes:string|null;library_bytes:string};
  events:{event:string;outcome:string;count:number}[];jobs:Count[];
  worker:{delivered:number;failed:number;checked_at:string}|null;integrations:{smtp:boolean;google:boolean};
  migrations:{version:string;checksum:string;applied_at:string}[];readiness:string;sampledAt:string;
};
const sum=(rows:Count[])=>rows.reduce((total,row)=>total+row.count,0);
const states:Record<string,string>={active:"Aktif",unverified:"Belum terverifikasi",blocked:"Diblokir",suspended:"Suspend",banned:"Banned",new:"Baru",in_progress:"Ditangani",resolved:"Selesai",spam:"Spam",draft:"Draf",in_review:"Ditinjau",approved:"Disetujui",published:"Terbit",archived:"Arsip",trash:"Sampah",running:"Berjalan",completed:"Selesai",failed:"Gagal"};
const statuses=["new","in_progress","resolved","spam"];
const priorities=["low","normal","high","urgent"];
const fmt=new Intl.NumberFormat("id-ID");
const bytes=(number:string|null)=>number===null?"Belum tersedia":`${fmt.format(Number(number))} byte`;

export function AdminSummary({mode,navigate}:{mode:"dashboard"|"statistics"|"security";navigate:(panel:string,room?:string)=>void}) {
  const {data,error,reload}=useAdminData<Summary>("/api/admin/summary");
  const live=useAdminData<{status:string}>("/api/health/live");
  const title={dashboard:"Dashboard",statistics:"Statistik & Monitoring",security:"Keamanan & Audit"}[mode];
  return <><AdminHeading>{title}</AdminHeading>
    <button className={textButton} onClick={()=>{reload();live.reload();}}>Muat ulang</button>
    <p>Proses aplikasi {live.error?"tidak dapat diperiksa":live.data?"merespons":"sedang diperiksa"}.{data&&<> Snapshot basis data {localDate(data.sampledAt)}.</>}</p>
    {!data?<AdminLoading error={error}/>:<>
    {mode==="dashboard"&&<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button className={adminPanel} onClick={()=>navigate("users")}>Pengguna<br/><strong>{sum(data.users)}</strong></button>
        <button className={adminPanel} onClick={()=>navigate("reports")}>Laporan terbuka<br/><strong>{sum(data.reports.filter(row=>["new","in_progress"].includes(row.status)))}</strong></button>
        <button className={adminPanel} onClick={()=>navigate("content")}>Konten yang dapat dibaca<br/><strong>{data.content.reduce((n,row)=>n+row.visible,0)}</strong></button>
        <button className={adminPanel} onClick={()=>navigate("system")}>Database<br/><strong>{data.readiness==="ready"?"Terhubung":data.readiness==="schema_pending"?"Migrasi belum lengkap":"Tidak tersedia"}</strong></button>
      </div>
      <section className={adminPanel}><h2>Ruang Madevi</h2>{rooms.map(room=>{
        const rows=data.content.filter(row=>row.space===room.slug);
        return <div className="border-b border-madevi-line py-3" key={room.slug}><button className={textButton} onClick={()=>navigate("content",room.slug)}>{room.name}</button>
        <p>{rows.reduce((n,row)=>n+row.visible,0)} dapat dibaca{rows.length?" · "+rows.map(row=>`${states[row.status]} ${row.count}`).join(" · "):""}</p></div>;
      })}</section>
    </>}
    {mode!=="security"&&<section className={adminPanel}><h2>Pengguna dan laporan</h2>
      <p>Jumlah seluruh akun menurut status saat ini. Suspend yang sudah lewat kembali ke status akun biasa.</p>
      <ul>{["active","unverified","blocked","suspended","banned"].map(status=><li key={status}>{states[status]} · {data.users.find(row=>row.status===status)?.count??0}</li>)}</ul>
      <p>Laporan sepanjang riwayat, menurut status penanganan saat ini.</p><ul>{statuses.map(status=><li key={status}>{states[status]} · {data.reports.find(row=>row.status===status)?.count??0}</li>)}</ul>
    </section>}
    {mode==="statistics"&&<section className={adminPanel}><h2>Kapasitas dan pekerjaan</h2>
      <p>Ukuran database PostgreSQL {bytes(data.usage.database_bytes)}. Gambar di pustaka {bytes(data.usage.library_bytes)}. Ukuran database mencakup pustaka.</p>
      <p>Konten berdasarkan alur kerja saat ini.</p><ul>{["draft","in_review","approved","published","archived","trash"].map(status=><li key={status}>{states[status]} · {sum(data.content.filter(row=>row.status===status))}</li>)}</ul>
      <p>Seluruh pekerjaan backup dan pemulihan yang tercatat.</p><ul>{["running","completed","failed"].map(status=><li key={status}>{states[status]} · {data.jobs.find(row=>row.status===status)?.count??0}</li>)}</ul>
      <p>Putaran worker terakhir {data.worker?`${localDate(data.worker.checked_at)} · ${data.worker.delivered} pekerjaan berhasil · ${data.worker.failed} pekerjaan gagal`:"belum tercatat"}. Cocokkan waktunya dengan interval scheduler host.</p>
      <p>SMTP {data.integrations.smtp?"terkonfigurasi, pengiriman perlu diuji":"belum dikonfigurasi"}. Google {data.integrations.google?"terkonfigurasi, callback perlu diuji":"belum dikonfigurasi"}.</p>
      <p>Pemeriksaan halaman ini membaca data aplikasi. Pantauan uptime dan kapasitas disk host memerlukan monitor di lingkungan deployment.</p>
    </section>}
    {mode==="statistics"&&<OperationsMonitoring/>}
    {mode==="security"&&<p><a href="/admin/security">Lihat status autentikator</a></p>}
    {mode!=="dashboard"&&<section className={adminPanel}><h2>Peristiwa keamanan 24 jam</h2>{data.events.length?<ul>{data.events.map(row=><li key={row.event+row.outcome}>{row.event} · {row.outcome} · {row.count}</li>)}</ul>:<p>Nol peristiwa tercatat.</p>}</section>}
    <section className={adminPanel}><h2>Aktivitas terbaru</h2><p>Maksimal 20 entri audit admin terbaru.</p>
      {data.audit.length?<ul>{data.audit.map((row,i)=><li key={i}>{localDate(row.created_at)} · {row.action} · {row.target_id} · {row.outcome}{mode==="security"&&` · admin ${row.actor_id}`}</li>)}</ul>:<p>Belum ada tindakan yang tercatat.</p>}
    </section>
  </>}</>;
}

type Account={id:string;name:string;email:string;username:string|null;status:string;role:string;restricted_until?:string;sessions?:number};
type AccountList={users:Account[];pagination:{hasNext:boolean}};
export function AdminAccounts() {
  const [q,setQ]=useState(""), [status,setStatus]=useState(""), [page,setPage]=useState(1), [id,setId]=useState("");
  const [action,setAction]=useState("block"), [message,setMessage]=useState(""), [busy,setBusy]=useState(false);
  const users=useAdminData<AccountList>(`/api/admin/users?${new URLSearchParams({q,page:String(page),limit:"25",...(status?{status}:{})})}`);
  const details=useAdminData<{account:Account;history:Audit[]}>(id?`/api/admin/users?${new URLSearchParams({id})}`:"");
  return <><AdminHeading>Pengguna</AdminHeading><section className={adminPanel}>
    <label className={fieldLabel}>Cari akun<input className={inputControl} value={q} maxLength={100} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label>
    <label className={fieldLabel}>Status<select className={inputControl} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Semua</option>{["active","unverified","blocked","suspended","banned"].map(x=><option key={x} value={x}>{states[x]}</option>)}</select></label>
  </section>
  {!users.data?<AdminLoading error={users.error}/>:<section className={adminPanel}><h2>Daftar akun</h2>{users.data.users.length?users.data.users.map(user=><div className="border-b border-madevi-line py-3" key={user.id}>
    <strong>{user.name}</strong><p>{user.email} · {states[user.status]}{user.role==="admin"?" · Admin utama":""}</p>
    <button className={textButton} onClick={()=>{setId(user.id);setMessage("");}}>Lihat akun {user.name}</button>
  </div>):<p>Tidak ada pengguna yang sesuai.</p>}<AdminPageNav page={page} next={users.data.pagination.hasNext} move={setPage}/></section>}
  {id && (!details.data?<AdminLoading error={details.error}/>:<section className={adminPanel}><h2>Detail {details.data.account.name}</h2>
    <p>ID {details.data.account.id} · {details.data.account.username??"Username belum diisi"} · {states[details.data.account.status]} · {details.data.account.sessions} sesi aktif</p>
    {details.data.account.status==="suspended"&&details.data.account.restricted_until&&<p>Suspend hingga {localDate(details.data.account.restricted_until)}</p>}
    {details.data.account.role==="user"?<form className="grid gap-3" onSubmit={async event=>{
      event.preventDefault();
      if(!window.confirm(`Terapkan tindakan pada akun ${details.data?.account.name}?`))return;
      const data=values(event.currentTarget);
      setBusy(true);setMessage("");
      try {await adminRequest("/api/admin/users",adminJson("POST",{id,action,reason:value(data,"reason"),...(action==="suspend"?{until:new Date(value(data,"until")).toISOString()}:{})}));setMessage("Tindakan tersimpan.");users.reload();details.reload();}
      catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
    }}>
    <label className={fieldLabel}>Tindakan<select className={inputControl} value={action} onChange={event=>setAction(event.target.value)}><option value="block">Blokir</option><option value="suspend">Suspend sementara</option><option value="ban">Banned</option><option value="revoke">Cabut sesi</option><option value="restore">Pulihkan</option></select></label>
    {action==="suspend"&&<label className={fieldLabel}>Sampai waktu lokal<input name="until" type="datetime-local" required className={inputControl}/></label>}
    <label className={fieldLabel}>Alasan<input name="reason" className={inputControl} minLength={3} maxLength={500} required/></label>
    <button className={primaryButton} disabled={busy}>Terapkan tindakan</button></form>:<p>Akun admin utama dilindungi dari tindakan pembatasan.</p>}
    {message&&<p role="status" className={statusMessage}>{message}</p>}
    <h3>30 tindakan terakhir</h3>{details.data.history.length?<ul>{details.data.history.map((row,index)=><li key={index}>{localDate(row.created_at)} · {row.action} · {row.reason} · {row.outcome} · admin {row.actor_id}</li>)}</ul>:<p>Belum ada riwayat.</p>}
  </section>)}</>;
}

type Report={id:string;body:string;created_at:string;reference_url:string|null;status:string;priority:string;has_image:boolean;automatic_response:string|null};
export function AdminReports() {
  const [status,setStatus]=useState(""), [priority,setPriority]=useState(""), [page,setPage]=useState(1), [selected,setSelected]=useState("");
  const list=useAdminData<{reports:Report[];pagination:{hasNext:boolean}}>(`/api/admin/reports?${new URLSearchParams({page:String(page),limit:"25",...(status?{status}:{}),...(priority?{priority}:{})})}`);
  const history=useAdminData<{history:{actor_id:string;status:string;priority:string;note:string;created_at:string}[]}>(selected?`/api/admin/reports?id=${selected}`:"");
  const [message,setMessage]=useState(""), [busy,setBusy]=useState(false);
  return <><AdminHeading>Laporan Masalah</AdminHeading><section className={adminPanel}>
    <label className={fieldLabel}>Filter status<select className={inputControl} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Semua</option>{statuses.map(x=><option key={x} value={x}>{states[x]}</option>)}</select></label>
    <label className={fieldLabel}>Filter prioritas<select className={inputControl} value={priority} onChange={e=>{setPriority(e.target.value);setPage(1);}}><option value="">Semua</option>{priorities.map(x=><option key={x}>{x}</option>)}</select></label>
    {message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>
  {!list.data?<AdminLoading error={list.error}/>:<section className={adminPanel}><h2>Antrean laporan</h2>{list.data.reports.length?list.data.reports.map(row=><article key={row.id} className="my-4 border-b border-madevi-line pb-4">
    <h3>Laporan #{row.id}</h3><time dateTime={row.created_at}>{localDate(row.created_at)}</time><p className="whitespace-pre-wrap">{row.body}</p>
    {row.reference_url&&<p><a href={row.reference_url} rel="noreferrer" target="_blank">Tautan terkait</a></p>}{row.has_image&&<p><a href={`/api/admin/reports/${row.id}/image`} rel="noreferrer" target="_blank">Bukti privat</a></p>}
    {row.automatic_response&&<p>Respons otomatis: {row.automatic_response}</p>}
    <form key={row.status+row.priority} className="grid gap-3" onSubmit={async e=>{
      e.preventDefault();const form=e.currentTarget,data=values(form);setBusy(true);setMessage("");
      try {await adminRequest("/api/admin/reports",adminJson("PATCH",{id:Number(row.id),status:value(data,"status"),priority:value(data,"priority"),note:value(data,"note")}));form.reset();list.reload();history.reload();setMessage("Laporan diperbarui.");}
      catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
    }}>
      <label className={fieldLabel}>Status laporan<select className={inputControl} name="status" defaultValue={row.status}>{statuses.map(x=><option key={x} value={x}>{states[x]}</option>)}</select></label>
      <label className={fieldLabel}>Prioritas<select className={inputControl} name="priority" defaultValue={row.priority}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className={fieldLabel}>Catatan penanganan<textarea className={textAreaControl} name="note" maxLength={1000}/></label>
      <button className={primaryButton} disabled={busy}>Simpan penanganan</button>
    </form><button className={textButton} onClick={()=>setSelected(selected===row.id?"":row.id)}>{selected===row.id?"Tutup riwayat":"Lihat riwayat"}</button>
    {selected===row.id&&(!history.data?<AdminLoading error={history.error}/>:history.data.history.length?<ul>{history.data.history.map((entry,i)=><li key={i}>{localDate(entry.created_at)} · {states[entry.status]} · {entry.priority} · {entry.note} · admin {entry.actor_id}</li>)}</ul>:<p>Belum ada penanganan.</p>)}
  </article>):<p>Belum ada laporan yang sesuai.</p>}<AdminPageNav page={page} next={list.data.pagination.hasNext} move={setPage}/></section>}</>;
}

type Rule={id:string;keyword:string|null;response:string;enabled:boolean;starts_at:string|null;ends_at:string|null};
export function AdminRules() {
  const [edit,setEdit]=useState<Rule>(), [message,setMessage]=useState(""), [pending,setPending]=useState(false);
  const {data,error,reload}=useAdminData<{rules:Rule[]}>("/api/admin/support");
  return <><AdminHeading description="Gunakan jawaban tetap. Semua laporan tetap masuk antrean untuk admin.">Asisten & Respons Otomatis</AdminHeading>
  <SupportAvailability/><SupportInbox admin/>
  <section className={adminPanel}><h2>{edit?"Edit aturan":"Buat aturan"}</h2>
    <form key={edit?.id??"new"} className="grid gap-3" onSubmit={async event=>{
      event.preventDefault();const form=event.currentTarget,data=values(form);setPending(true);setMessage("");
      const date=(key:string)=>value(data,key)?new Date(value(data,key)).toISOString():null;
      try {await adminRequest("/api/admin/support",adminJson("PUT",{id:edit?.id,keyword:value(data,"keyword"),response:value(data,"response"),startsAt:date("start"),endsAt:date("end"),enabled:data.has("enabled")}));form.reset();setEdit(undefined);reload();setMessage("Aturan tersimpan.");}
      catch(error){setMessage((error as Error).message);}finally{setPending(false);}
    }}>
      <label className={fieldLabel}>Kata kunci, kosong untuk jawaban umum<input className={inputControl} name="keyword" maxLength={100} defaultValue={edit?.keyword??""}/></label>
      <label className={fieldLabel}>Jawaban tetap<textarea className={textAreaControl} name="response" defaultValue={edit?.response} maxLength={2000} required/></label>
      <label className={fieldLabel}>Mulai, waktu lokal<input className={inputControl} type="datetime-local" name="start" defaultValue={dateInput(edit?.starts_at)}/></label>
      <label className={fieldLabel}>Berakhir, waktu lokal<input className={inputControl} type="datetime-local" name="end" defaultValue={dateInput(edit?.ends_at)}/></label>
      <label><input type="checkbox" name="enabled" defaultChecked={edit?.enabled??true}/> Aktif</label>
      <button className={primaryButton} disabled={pending}>Simpan aturan</button>{edit&&<button className={textButton} type="button" onClick={()=>setEdit(undefined)}>Batal edit</button>}
    </form>{message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>
  {!data?<AdminLoading error={error}/>:<section className={adminPanel}><h2>Aturan tersimpan</h2>{data.rules.length?data.rules.map(rule=><div className="border-b border-madevi-line py-3" key={rule.id}><strong>{rule.keyword??"Jawaban umum"} · {rule.enabled?"Aktif":"Nonaktif"}</strong><p>{rule.response}</p><button className={textButton} onClick={()=>setEdit(rule)}>Edit aturan</button></div>):<p>Belum ada aturan.</p>}</section>}
  </>;
}
