"use client";

import { useState } from "react";
import { adminJson, adminRequest, values, value } from "./admin-data";
import { fieldLabel, formLayout, inputControl, primaryButton, statusMessage, textAreaControl } from "./styles";

export function AdminNotifications() {
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);
  return <form className={formLayout} onSubmit={async e=>{
    e.preventDefault();
    if(!window.confirm("Publikasikan pengumuman untuk semua pengunjung?"))return;
    const form=e.currentTarget,data=values(form);
    setPending(true);setMessage("");
    try {await adminRequest("/api/admin/notifications",adminJson("POST",{audience:"general",title:value(data,"title"),body:value(data,"body")}));form.reset();setMessage("Pengumuman diterbitkan.");}
    catch(error){setMessage((error as Error).message);}finally{setPending(false);}
  }}>
    <label className={fieldLabel}>Judul publik<input className={inputControl} name="title" maxLength={160} required/></label>
    <label className={fieldLabel}>Isi publik<textarea className={textAreaControl} name="body" maxLength={2000} rows={5} required/></label>
    {message&&<p role="status" className={statusMessage}>{message}</p>}
    <button className={primaryButton} disabled={pending}>Terbitkan pengumuman</button>
  </form>;
}
