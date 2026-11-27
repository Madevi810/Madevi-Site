"use client";

import { useRef, useState } from "react";
import { AdminLoading, AdminPageNav, adminJson, adminRequest, localDate, useAdminData, value, values } from "./admin-data";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textAreaControl, textButton } from "./styles";
import type { Availability } from "@/lib/support-availability";

type Thread={id:string;title:string;status:string;version:number;updated_at:string};
type Post={id:string;sender:string;body:string;created_at:string};
const states:Record<string,string>={waiting_admin:"Menunggu admin",waiting_user:"Menunggu pengguna",resolved:"Selesai"};
const senders:Record<string,string>={admin:"Admin",user:"Pengguna",auto:"Respons otomatis",event:"Status",note:"Catatan internal"};
const sectionSpacing="my-4 rounded-xl border border-madevi-line p-4";

export function SupportInbox({admin=false}:{admin?:boolean}) {
  const base=admin?"/api/admin/support/conversations":"/api/support";
  const [id,setId]=useState(""),[page,setPage]=useState(1),[postPage,setPostPage]=useState(1),[status,setStatus]=useState("");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const active=useRef(false),requestId=useRef<{payload:string;id:string}|null>(null);
  const detailRef=useRef<HTMLElement>(null);
  const listing=useAdminData<{items:Thread[];next:boolean}>(`${base}?page=${page}${status?`&status=${status}`:""}`);
  const detail=useAdminData<{thread:Thread;posts:Post[];next:boolean}>(id?`${base}?id=${id}&page=${postPage}`:"");

  function select(next:string) {
    setId(next);setPostPage(1);
    requestAnimationFrame(()=>detailRef.current?.focus({preventScroll:true}));
  }
  async function send(action:string,body:Record<string,unknown>,form?:HTMLFormElement) {
    if(active.current)return;
    const signature=JSON.stringify({action,...body});
    if(requestId.current?.payload!==signature)requestId.current={payload:signature,id:crypto.randomUUID()};
    active.current=true;setBusy(true);setMessage("");
    try {
      const response=await adminRequest<{id:string}>(base,adminJson("POST",{action,
        ...(action==="create"?{id:requestId.current.id}:{postId:requestId.current.id}),...body}));
      requestId.current=null;form?.reset();
      if(action==="create")select(response.id);
      else setPostPage(1);
      detail.reload();listing.reload();setMessage("Perubahan percakapan tersimpan.");
    } catch(error){setMessage((error as Error).message);detail.reload();}
    finally{active.current=false;setBusy(false);}
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
        <button className={primaryButton} disabled={busy}>Buat percakapan</button>
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
    {id&&<section className={adminPanel} tabIndex={-1} ref={detailRef}>
      {!detail.data?<AdminLoading error={detail.error}/>:<>
        <h2>{detail.data.thread.title}</h2><p>{states[detail.data.thread.status]}</p>
        <ol>{detail.data.posts.map(post=><li className={sectionSpacing} key={post.id}>
          <strong>{senders[post.sender]}</strong> · <time dateTime={post.created_at}>{localDate(post.created_at)}</time>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{post.body}</p>
        </li>)}</ol>
        <AdminPageNav page={postPage} next={detail.data.next} move={setPostPage}/>
        {detail.data.thread.status!=="resolved"&&<form method="post" className="grid gap-3" onSubmit={event=>{
          event.preventDefault();const form=event.currentTarget,formData=values(form);
          void send("reply",{id,body:value(formData,"body"),version:detail.data?.thread.version},form);
        }}>
          <label className={fieldLabel}>Balasan<textarea className={textAreaControl} name="body" maxLength={4000} required/></label>
          <button className={primaryButton} disabled={busy}>Kirim balasan</button>
        </form>}
        {admin&&<>
          <form method="post" className="my-4 grid gap-3" onSubmit={event=>{
            event.preventDefault();const form=event.currentTarget,formData=values(form);
            void send("note",{id,body:value(formData,"note"),version:detail.data?.thread.version},form);
          }}>
            <label className={fieldLabel}>Catatan internal<textarea className={textAreaControl} name="note" maxLength={4000} required/></label>
            <button className={textButton} disabled={busy}>Simpan catatan internal</button>
          </form>
          <button className={textButton} disabled={busy} onClick={()=>{
            const action=detail.data?.thread.status==="resolved"?"reopen":"resolve";
            if(window.confirm(action==="reopen"?"Buka kembali percakapan ini?":"Selesaikan percakapan ini?"))void send(action,{id,version:detail.data?.thread.version});
          }}>{detail.data.thread.status==="resolved"?"Buka kembali":"Selesaikan percakapan"}</button>
        </>}
      </>}
    </section>}
  </div>;
}

const days=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
export function SupportAvailability() {
  const state=useAdminData<{settings:Availability;version:number;available:boolean}>("/api/admin/support/availability");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  return <section className={adminPanel}><h2>Ketersediaan admin</h2>
    {!state.data?<AdminLoading error={state.error}/>:<>
      <p>Pada pemeriksaan terakhir, admin {state.data.available?"tersedia":"tidak tersedia"} menurut pengaturan. Mode manual mengesampingkan jadwal.</p>
      <form method="post" className="grid gap-3" key={state.data.version} onSubmit={async event=>{
        event.preventDefault();if(busy||!state.data)return;
        const data=values(event.currentTarget);
        const windows=value(data,"windows").split("\n").map(x=>x.trim()).filter(Boolean).map(line=>{
          const parts=/^(Min|Sen|Sel|Rab|Kam|Jum|Sab) (\d\d:\d\d)-(\d\d:\d\d)$/.exec(line);
          return {day:days.indexOf(parts?.[1]??""),start:parts?.[2],end:parts?.[3]};
        });
        setBusy(true);setMessage("");
        try {
          await adminRequest("/api/admin/support/availability",adminJson("PUT",{version:state.data.version,settings:{mode:value(data,"mode"),zone:value(data,"zone"),windows,awayReply:value(data,"awayReply")}}));
          state.reload();setMessage("Ketersediaan tersimpan.");
        } catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
      }}>
        <label className={fieldLabel}>Mode<select aria-label="Mode ketersediaan" name="mode" className={inputControl} defaultValue={state.data.settings.mode}>
          <option value="available">Manual · tersedia</option><option value="unavailable">Manual · tidak tersedia</option><option value="schedule">Ikuti jadwal mingguan</option>
        </select></label>
        <label className={fieldLabel}>Zona waktu IANA<input name="zone" className={inputControl} defaultValue={state.data.settings.zone} required maxLength={64}/></label>
        <label className={fieldLabel}>Jam tersedia, satu baris per rentang<textarea name="windows" className={textAreaControl} rows={4} placeholder="Sen 09:00-17:00" defaultValue={state.data.settings.windows.map(row=>`${days[row.day]} ${row.start}-${row.end}`).join("\n")}/></label>
        <label className={fieldLabel}>Jawaban saat admin tidak tersedia<textarea name="awayReply" className={textAreaControl} rows={3} maxLength={2000} defaultValue={state.data.settings.awayReply}/></label>
        <button className={primaryButton} disabled={busy}>Simpan ketersediaan</button>
      </form>
    </>}
    {message&&<p role="status" className={statusMessage}>{message}</p>}
  </section>;
}
