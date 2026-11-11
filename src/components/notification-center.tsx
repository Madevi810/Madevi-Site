"use client";

import { useEffect, useId, useRef, useState } from "react";
type Category = "general" | "system" | "social";
type Notice = { id:string; category:Category; title:string; body:string; is_read:boolean; created_at:string };
type Result = {notifications:Notice[];signedIn:boolean;nextCursor:string|null};
const categories = [["general","Umum","General"],["system","Sistem","System"],["social","Sosial","Social"]] as const;

export function NotificationCenter({english,onClose}:{english:boolean;onClose:()=>void}){
  const [category,setCategory]=useState<Category>("general");
  const [rows,setRows]=useState<Notice[]>([]);
  const [signedIn,setSignedIn]=useState(false);
  const [cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const sequence=useRef(0);const tabRefs=useRef<Array<HTMLButtonElement|null>>([]);const groupId=useId();
  const t=(id:string,en:string)=>english?en:id;
  useEffect(()=>{
    const current=++sequence.current;const controller=new AbortController();
    setRows([]);setCursor(null);setLoading(true);setLoadingMore(false);setError("");
    const q=new URLSearchParams({category,limit:"20"});
    fetch(`/api/notifications?${q}`,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Result>})
      .then(data=>{if(current===sequence.current){setRows(data.notifications);setSignedIn(data.signedIn);setCursor(data.nextCursor)}})
      .catch(()=>{if(!controller.signal.aborted&&current===sequence.current)setError(english?"Notifications are unavailable.":"Notifikasi belum tersedia.")})
      .finally(()=>{if(current===sequence.current)setLoading(false)});
    return ()=>{controller.abort();sequence.current++};
  },[category,english,revision]);
  async function loadMore(){
    if(!cursor||loadingMore)return;const current=sequence.current;setLoadingMore(true);setError("");
    try{const q=new URLSearchParams({category,limit:"20",cursor});const r=await fetch(`/api/notifications?${q}`,{cache:"no-store"});if(!r.ok)throw Error();const data:Result=await r.json();if(current===sequence.current){setRows(old=>{const ids=new Set(old.map(x=>x.id));return [...old,...data.notifications.filter(x=>!ids.has(x.id))]});setCursor(data.nextCursor)}}
    catch{if(current===sequence.current)setError(t("Notifikasi berikutnya belum dapat dimuat.","More notifications could not be loaded."))}
    finally{if(current===sequence.current)setLoadingMore(false)}
  }
  async function mark(n:Notice){
    if(signedIn&&!n.is_read){
      try{const r=await fetch("/api/notifications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:n.id})});if(!r.ok)throw Error();setRows(old=>old.map(x=>x.id===n.id?{...x,is_read:true}:x))}
      catch{setError(t("Status belum dapat disimpan. Coba lagi.","Could not save status. Please try again."));return}
    }
    onClose();
  }
  function keyboard(e:React.KeyboardEvent<HTMLDivElement>){
    const index=categories.findIndex(x=>x[0]===category);let next=index;
    if(e.key==="ArrowRight")next=(index+1)%categories.length;else if(e.key==="ArrowLeft")next=(index+categories.length-1)%categories.length;else if(e.key==="Home")next=0;else if(e.key==="End")next=categories.length-1;else return;
    e.preventDefault();setCategory(categories[next][0]);tabRefs.current[next]?.focus();
  }
  return <section aria-label={t("Notifikasi","Notifications")} className="w-madevi-notification text-madevi-text"><strong>{t("Notifikasi","Notifications")}</strong>
    <div className="my-madevi-12 flex gap-madevi-3 border-0 border-b border-solid border-madevi-line" role="tablist" aria-label={t("Kelompok notifikasi","Notification groups")} onKeyDown={keyboard}>
      {categories.map(([id,label,en],index)=><button ref={node=>{tabRefs.current[index]=node}} className="flex-1 border-0 border-b-2 border-solid border-transparent bg-transparent px-madevi-3 py-madevi-9 text-madevi-12 text-madevi-muted aria-selected:border-madevi-accent aria-selected:font-bold aria-selected:text-madevi-text" key={id} id={`${groupId}-${id}`} aria-controls={`${groupId}-panel`} type="button" role="tab" tabIndex={category===id?0:-1} aria-selected={category===id} onClick={()=>setCategory(id)}>{t(label,en)}</button>)}
    </div>
    <div id={`${groupId}-panel`} aria-labelledby={`${groupId}-${category}`} className="max-h-madevi-260 overflow-auto text-madevi-12 text-madevi-muted" role="tabpanel" aria-busy={loading||loadingMore}>
      {loading?<p role="status">{t("Memuat notifikasi…","Loading notifications…")}</p>:category!=="general"&&!signedIn?<p>{t("Masuk untuk melihat notifikasi pribadi.","Sign in to view personal notifications.")}</p>:rows.length?rows.map(n=><button key={n.id} className="flex w-full flex-col gap-madevi-5 border-0 border-b border-solid border-madevi-line bg-transparent px-0 py-madevi-12 text-left" type="button" onClick={()=>void mark(n)}><strong className="text-madevi-text">{n.title}</strong><span>{n.body}</span><time dateTime={n.created_at}>{new Intl.DateTimeFormat(english?"en":"id",{dateStyle:"medium",timeStyle:"short"}).format(new Date(n.created_at))}</time>{!n.is_read&&signedIn&&<small className="text-madevi-accent">{t("Belum dibaca","Unread")}</small>}</button>):!error?<p>{t("Belum ada notifikasi.","No notifications yet.")}</p>:null}
      {error&&<div role="alert"><p>{error}</p>{!rows.length&&<button type="button" className="border-0 bg-transparent p-madevi-6 text-madevi-accent" onClick={()=>setRevision(x=>x+1)}>{t("Coba lagi","Try again")}</button>}</div>}
      {cursor&&<button type="button" className="border-0 bg-transparent p-madevi-6 text-madevi-accent" disabled={loadingMore} onClick={()=>void loadMore()}>{loadingMore?t("Memuat…","Loading…"):t("Muat lebih banyak","Load more")}</button>}
    </div>
  </section>;
}
