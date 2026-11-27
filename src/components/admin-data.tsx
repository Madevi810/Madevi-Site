"use client";

import { useEffect, useState } from "react";
import { adminPanel, adminTitle, textButton } from "./styles";

export class AdminRequestError extends Error {
  constructor(message:string,readonly uncertain:boolean,readonly requestId?:string,readonly status?:number) {
    super(requestId ? `${message} ID permintaan ${requestId}.` : message);
  }
}

export async function adminRequest<T=unknown>(url:string, options?:RequestInit):Promise<T> {
  const response=await fetch(url,{cache:"no-store",...options}).catch(error=>{
    if(error instanceof Error&&error.name==="AbortError")throw error;
    throw new AdminRequestError("Koneksi terputus. Hasil tindakan belum diketahui.",true);
  });
  const data=await response.json().catch(()=>null);
  const requestId=response.headers.get("x-request-id")??undefined;
  if(!response.ok) throw new AdminRequestError(typeof data?.error==="string"?data.error:data?.error?.message??"Permintaan gagal.",response.status>=500,requestId,response.status);
  if(data===null)throw new AdminRequestError("Respons tidak lengkap. Hasil tindakan belum diketahui.",true,requestId);
  return data;
}
export function adminJson(method:string,body:unknown):RequestInit {
  return {method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
}
export function useAdminData<T>(url:string) {
  const [state,setState]=useState<{url:string;data?:T;error?:string}>();
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    if(!url) return;
    const controller=new AbortController();
    adminRequest<T>(url,{signal:controller.signal})
      .then(data=>setState({url,data}))
      .catch(error=>{if(!controller.signal.aborted)setState({url,error:error.message});});
    return ()=>controller.abort();
  },[url,version]);
  return {...(state?.url===url?state:undefined),reload:()=>setVersion(v=>v+1)};
}
export function AdminHeading({children,description}:{children:React.ReactNode;description?:string}) {
  return <div className={adminTitle}><div><h1>{children}</h1>{description&&<p>{description}</p>}</div></div>;
}
export function AdminPageNav({page,next,move,disabled}:{page:number;next?:boolean;move:(page:number)=>void;disabled?:boolean}) {
  return <nav className="my-4 flex flex-wrap items-center gap-4" aria-label="Navigasi halaman">
    <button type="button" className={textButton} disabled={disabled||page===1} onClick={()=>move(page-1)}>Sebelumnya</button>
    <span aria-live="polite">Halaman {page}</span>
    <button type="button" className={textButton} disabled={disabled||!next} onClick={()=>move(page+1)}>Berikutnya</button>
  </nav>;
}
export function AdminLoading({error}:{error?:string}) {
  return <section className={adminPanel}><p role={error?"alert":"status"}>{error??"Memuat data…"}</p></section>;
}
export function localDate(value:string|null|undefined) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}
export function dateInput(value:string|null|undefined) {
  if(!value) return "";
  const date=new Date(value);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export const values=(form:HTMLFormElement)=>new FormData(form);
export const value=(data:FormData,key:string)=>String(data.get(key)??"");
export const splitLines=(text:string)=>text.split("\n").map(line=>line.trim()).filter(Boolean);
