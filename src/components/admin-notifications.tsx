"use client";

import { useRef, useState } from "react";
import { AdminRequestError, adminJson, adminRequest, values, value } from "./admin-data";
import { fieldLabel, formLayout, inputControl, primaryButton, statusMessage, textAreaControl } from "./styles";

export function AdminNotifications() {
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false),[retry,setRetry]=useState(false);
  const attempt=useRef<{audience:string;id:string;title:string;body:string}|null>(null),active=useRef(false);
  return <form className={formLayout} onSubmit={async e=>{
    e.preventDefault();
    if(active.current||(!retry&&!window.confirm("Publikasikan pengumuman untuk semua pengunjung?")))return;
    const form=e.currentTarget,data=values(form);
    attempt.current??={audience:"general",id:crypto.randomUUID(),title:value(data,"title"),body:value(data,"body")};
    active.current=true;setPending(true);setMessage("");
    try {
      await adminRequest("/api/admin/notifications",adminJson("POST",attempt.current));
      attempt.current=null;setRetry(false);form.reset();setMessage("Pengumuman diterbitkan.");
    } catch(error) {
      const uncertain=error instanceof AdminRequestError&&(error.uncertain||retry&&error.status===429);
      if(!uncertain)attempt.current=null;
      setRetry(uncertain);setMessage((error as Error).message);
    } finally {active.current=false;setPending(false);}
  }}>
    <label className={fieldLabel}>Judul publik<input className={inputControl} name="title" maxLength={160} required disabled={pending||retry}/></label>
    <label className={fieldLabel}>Isi publik<textarea className={textAreaControl} name="body" maxLength={2000} rows={5} required disabled={pending||retry}/></label>
    {message&&<p role="status" className={statusMessage}>{message}</p>}
    <button className={primaryButton} disabled={pending}>{retry?"Periksa dengan coba kembali":"Terbitkan pengumuman"}</button>
  </form>;
}
