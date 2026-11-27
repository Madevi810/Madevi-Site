"use client";

import { useRef, useState } from "react";
import { AdminRequestError, AdminLoading, AdminPageNav, adminJson, adminRequest, localDate, useAdminData, value, values } from "./admin-data";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";
import type { Availability } from "@/lib/support-availability";

type Thread={id:string;title:string;status:string;version:number;updated_at:string};
type Post={id:string;sender:string;body:string;created_at:string};
const states:Record<string,string>={waiting_admin:"Menunggu admin",waiting_user:"Menunggu pengguna",resolved:"Selesai"};
const senders:Record<string,string>={admin:"Admin",user:"Pengguna",auto:"Respons otomatis",event:"Status",note:"Catatan internal"};
const sectionSpacing="my-4 rounded-xl border border-madevi-line p-4";

export function SupportInbox({admin=false}:{admin?:boolean}) {
  const base=admin?"/api/admin/support/conversations":"/api/support";
  const [id,setId]=useState(""),[page,setPage]=useState(1),[cursors,setCursors]=useState<string[]>([]),[status,setStatus]=useState("");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const active=useRef(false);
  const [retry,setRetry]=useState<{action:string;data:Record<string,unknown>;form?:HTMLFormElement}>();
  const detailRef=useRef<HTMLElement>(null);
  const listing=useAdminData<{items:Thread[];next:boolean}>(`${base}?page=${page}${status?`&status=${status}`:""}`);
  const lastCursor=cursors.at(-1);
  const detail=useAdminData<{thread:Thread;posts:Post[];before:string|null}>(id?`${base}?id=${id}${lastCursor?`&before=${lastCursor}`:""}`:"");

  function select(next:string) {
    setId(next);setCursors([]);
    requestAnimationFrame(()=>detailRef.current?.focus({preventScroll:true}));
  }
  async function submit(attempt:NonNullable<typeof retry>) {
    if(active.current)return;
    active.current=true;setBusy(true);setMessage("");
    try {
      const response=await adminRequest<{id:string}>(base,adminJson("POST",attempt.data));
      setRetry(undefined);attempt.form?.reset();
      if(attempt.action==="create")select(response.id);
      else setCursors([]);
      detail.reload();listing.reload();setMessage("Perubahan percakapan tersimpan.");
    } catch(error){
      setRetry(error instanceof AdminRequestError&&(error.uncertain||Boolean(retry)&&error.status===429)?attempt:undefined);
      setMessage((error as Error).message);detail.reload();
    } finally{active.current=false;setBusy(false);}
  }
  function send(action:string,body:Record<string,unknown>,form?:HTMLFormElement) {
    if(retry)return;
    const id=crypto.randomUUID();
    void submit({action,data:{action,...(action==="create"?{id}:{postId:id}),...body},form});
  }

  return <div className={admin?"": "text-madevi-text"}>
    {!admin&&<section className={adminPanel}><h2>Percakapan baru</h2>
      <p>Percakapan dapat dilihat oleh akun Anda dan admin.</p>
      <form method="post" className="grid gap-3" onSubmit={event=>{
        event.preventDefault();const form=event.currentTarget,formData=values(form);
        void send("create",{title:value(formData,"title"),body:value(formData,"body")},form);
      }}>
        <label className={fieldLabel}>Topik<input className={inputControl} name="title" maxLength={160} required/></label>
        <label className={fieldLabel}>Pertanyaan<textarea className={textAreaControl} name="body" maxLength={4000} required/></label>
        <button className={primaryButton} disabled={busy||Boolean(retry)}>Buat percakapan</button>
      </form>
    </section>}
    <section className={adminPanel}><h2>{admin?"Antrean percakapan":"Percakapan saya"}</h2>
      <label className={fieldLabel}>Status percakapan<select className={inputControl} value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}>
        <option value="">Semua</option>{Object.entries(states).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <button className={textButton} onClick={()=>{listing.reload();detail.reload();}}>Muat ulang percakapan</button>
      {!listing.data?<AdminLoading error={listing.error}/>:<>
        {listing.data.items.length?<ul>{listing.data.items.map(row=><li key={row.id} className="border-b border-madevi-line py-2">
          <button className={textButton} aria-current={row.id===id?"true":undefined} onClick={()=>select(row.id)}>{row.title}</button>
          <p>{states[row.status]} · {localDate(row.updated_at)}</p>
        </li>)}</ul>:<p>Belum ada percakapan pada filter ini.</p>}
        <AdminPageNav page={page} next={listing.data.next} move={setPage}/>
      </>}
    </section>
    {message&&<p className={statusMessage} role="status">{message}</p>}
    {retry&&<div className={sectionSpacing}><p>Periksa hasil dengan mengirim ulang permintaan yang sama.</p><button className={primaryButton} disabled={busy} onClick={()=>void submit(retry)}>Periksa dengan coba kembali</button></div>}
    {id&&<section className={adminPanel} tabIndex={-1} ref={detailRef}>
      {!detail.data?<AdminLoading error={detail.error}/>:<>
        <h2>{detail.data.thread.title}</h2><p>{states[detail.data.thread.status]}</p>
        <ol>{detail.data.posts.map(post=><li className={sectionSpacing} key={post.id}>
          <strong>{senders[post.sender]}</strong> · <time dateTime={post.created_at}>{localDate(post.created_at)}</time>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{post.body}</p>
        </li>)}</ol>
        <AdminPageNav page={cursors.length+1} next={Boolean(detail.data.before)} move={next=>{
          const before=detail.data?.before;
          if(next<=cursors.length)setCursors(cursors.slice(0,-1));
          else if(before)setCursors([...cursors,before]);
        }}/>
        {detail.data.thread.status!=="resolved"&&<form method="post" className="grid gap-3" onSubmit={event=>{
          event.preventDefault();const form=event.currentTarget,formData=values(form);
          void send("reply",{id,body:value(formData,"body"),version:detail.data?.thread.version},form);
        }}>
          <label className={fieldLabel}>Balasan<textarea className={textAreaControl} name="body" maxLength={4000} required/></label>
          <button className={primaryButton} disabled={busy||Boolean(retry)}>Kirim balasan</button>
        </form>}
        {admin&&<>
          <form method="post" className="my-4 grid gap-3" onSubmit={event=>{
            event.preventDefault();const form=event.currentTarget,formData=values(form);
            void send("note",{id,body:value(formData,"note"),version:detail.data?.thread.version},form);
          }}>
            <label className={fieldLabel}>Catatan internal<textarea className={textAreaControl} name="note" maxLength={4000} required/></label>
            <button className={textButton} disabled={busy||Boolean(retry)}>Simpan catatan internal</button>
          </form>
          <button className={textButton} disabled={busy||Boolean(retry)} onClick={()=>{
            const action=detail.data?.thread.status==="resolved"?"reopen":"resolve";
            if(window.confirm(action==="reopen"?"Buka kembali percakapan ini?":"Selesaikan percakapan ini?"))void send(action,{id,version:detail.data?.thread.version});
          }}>{detail.data.thread.status==="resolved"?"Buka kembali":"Selesaikan percakapan"}</button>
        </>}
      </>}
    </section>}
  </div>;
}

const days=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
export function SupportAvailability() {
  const state=useAdminData<{settings:Availability;version:number;available:boolean}>("/api/admin/support/availability");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<{version:number;windows:Availability["windows"]}>();
  const version=state.data?.version;
  const windows=editing&&editing.version===version?editing.windows:state.data?.settings.windows??[];
  function update(windows:Availability["windows"]) {
    if(version!==undefined)setEditing({version,windows});
  }
  return <section className={adminPanel}><h2>Ketersediaan admin</h2>
    {!state.data?<AdminLoading error={state.error}/>:<>
      <button className={textButton} onClick={state.reload}>Muat ulang pengaturan</button>
      <p>Balasan otomatis memakai FAQ atau teks yang Anda isi pada pertanyaan pertama. Percakapan tetap masuk antrean admin.</p>
      <p>Pada pemeriksaan terakhir, admin {state.data.available?"tersedia":"tidak tersedia"} menurut pengaturan. Mode manual mengesampingkan jadwal.</p>
      <form method="post" className="grid gap-3" key={state.data.version} onSubmit={async event=>{
        event.preventDefault();if(busy||!state.data)return;
        const data=values(event.currentTarget);
        setBusy(true);setMessage("");
        try {
          await adminRequest("/api/admin/support/availability",adminJson("PUT",{version:state.data.version,settings:{mode:value(data,"mode"),zone:value(data,"zone"),windows,awayReply:value(data,"awayReply")}}));
          setEditing(undefined);state.reload();setMessage("Ketersediaan tersimpan.");
        } catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
      }}>
        <label className={fieldLabel}>Mode<select aria-label="Mode ketersediaan" name="mode" className={inputControl} defaultValue={state.data.settings.mode}>
          <option value="available">Manual · tersedia</option><option value="unavailable">Manual · tidak tersedia</option><option value="schedule">Ikuti jadwal mingguan</option>
        </select></label>
        <label className={fieldLabel}>Zona waktu<input name="zone" className={inputControl} defaultValue={state.data.settings.zone} required maxLength={64} aria-describedby="availability-zone"/></label>
        <p id="availability-zone">Gunakan nama zona seperti Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura.</p>
        <fieldset className="grid gap-3"><legend>Jam tersedia per minggu</legend>
          <p>Jam mulai harus sebelum jam selesai. Pisahkan jam yang melewati tengah malam menjadi dua rentang. Pilih akhir hari untuk pukul 24.00.</p>
          {windows.map((row,index)=><div key={index} className="grid gap-2 sm:grid-cols-3">
            <label className={fieldLabel}>Hari {index+1}<select className={inputControl} value={row.day} onChange={e=>update(windows.map((item,i)=>i===index?{...item,day:Number(e.target.value)}:item))}>
              {days.map((day,i)=><option key={day} value={i}>{day}</option>)}
            </select></label>
            <label className={fieldLabel}>Mulai<input type="time" className={inputControl} value={row.start} required onChange={e=>update(windows.map((item,i)=>i===index?{...item,start:e.target.value}:item))}/></label>
            <div><label className={fieldLabel}>Selesai<input type="time" className={inputControl} value={row.end==="24:00"?"":row.end} required={row.end!=="24:00"} disabled={row.end==="24:00"} onChange={e=>update(windows.map((item,i)=>i===index?{...item,end:e.target.value}:item))}/></label>
              <label><input type="checkbox" checked={row.end==="24:00"} onChange={e=>update(windows.map((item,i)=>i===index?{...item,end:e.target.checked?"24:00":"17:00"}:item))}/> Akhir hari</label>
            </div>
            <button type="button" className={textButton} onClick={()=>update(windows.filter((_,i)=>i!==index))}>Hapus rentang {index+1}</button>
          </div>)}
          <button type="button" className={textButton} disabled={windows.length>=28} onClick={()=>update([...windows,{day:1,start:"09:00",end:"17:00"}])}>Tambah rentang</button>
        </fieldset>
        <label className={fieldLabel}>Jawaban saat admin tidak tersedia<textarea name="awayReply" className={textAreaControl} rows={3} maxLength={2000} defaultValue={state.data.settings.awayReply}/></label>
        <button className={primaryButton} disabled={busy}>Simpan ketersediaan</button>
      </form>
    </>}
    {message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>;
}
