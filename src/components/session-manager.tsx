"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Field } from "./ui";
import { fineText, formLayout, outlineButton, primaryButton, statusMessage, textButton } from "./styles";

type Session = {id:string; current:boolean; createdAt:string; activeAt:string; expiresAt:string};

export function SessionManager({english=false}:{english?:boolean}) {
  const t=(id:string,en:string)=>english?en:id;
  const [items,setItems]=useState<Session[]>();
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const display=(time:string)=>new Date(time).toLocaleString(english?"en":"id");
  async function update(id?:string) {
    if(pending)return;
    setPending(true);setMessage("");
    try {
      if(id) {
        const response=await fetch("/api/account/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
        if(!response.ok)throw Error();
        setItems(current=>current?.filter(session=>session.id!==id));
        setMessage(t("Sesi dicabut.","Session revoked."));
      } else {
        const response=await fetch("/api/account/sessions",{cache:"no-store"});
        if(!response.ok)throw Error();
        setItems((await response.json()).items);
      }
    } catch {setMessage(t("Sesi belum dapat diperiksa. Muat ulang atau masuk kembali.","Could not check sessions. Reload or sign in again."));}
    finally {setPending(false);}
  }
  return <details><summary>{t("Kelola sesi masuk","Manage signed-in sessions")}</summary>
    <p className={fineText}>{t("Hingga 50 sesi aktif. Gunakan Keluar untuk sesi ini.","Up to 50 active sessions. Use Sign out for the current session.")}</p>
    <button type="button" className={textButton} disabled={pending} onClick={()=>void update()}>{t("Muat sesi aktif","Load active sessions")}</button>
    {items&&<ul>{items.map(item=><li key={item.id} className="border-b border-madevi-line pb-2">
      <p>{item.current?t("Sesi ini","This session"):t("Sesi lain","Other session")} · {display(item.createdAt)}</p>
      <p className={fineText}>{t("Aktivitas terakhir","Last activity")} {display(item.activeAt)} · {t("Batas akhir","Expires no later than")} {display(item.expiresAt)}</p>
      {!item.current&&<button type="button" className={textButton} disabled={pending} onClick={()=>void update(item.id)}
        aria-label={`${t("Cabut sesi","Revoke session")} ${display(item.createdAt)}`}>{t("Cabut sesi","Revoke session")}</button>}
    </li>)}</ul>}
    {message&&<p role="status" className={statusMessage}>{message}</p>}
  </details>;
}

export function AccountPassword({admin=false,english=false}:{admin?:boolean;english?:boolean}) {
  const t=(id:string,en:string)=>english?en:id;
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  return <details><summary>{t("Ganti kata sandi","Change password")}</summary>
    <p className={fineText}>{t("Semua sesi berakhir setelah kata sandi diganti.","All sessions end when your password changes.")}</p>
    <form method="post" className={formLayout} onSubmit={async event=>{
      event.preventDefault();
      if(pending)return;
      const form=event.currentTarget, fields=new FormData(form);
      setPending(true);setMessage("");
      try {
        const response=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({currentPassword:fields.get("current"),newPassword:fields.get("next")})});
        if(!response.ok) {
          const result=await response.json().catch(()=>null);
          setMessage(typeof result?.error==="string"?result.error:t("Periksa kata sandi atau masuk kembali.","Check your password or sign in again."));
          return;
        }
        if(admin)location.assign("/admin");
        else {setMessage(t("Kata sandi diganti. Masuk kembali.","Password changed. Sign in again."));await authClient.signOut();}
      } catch {setMessage(t("Periksa keadaan akun sebelum mencoba kembali.","Check your account before trying again."));}
      finally {form.reset();setPending(false);}
    }}>
      <Field label={t("Kata sandi saat ini","Current password")} name="current" type="password" autoComplete="current-password" maxLength={128} required/>
      <Field label={t("Kata sandi baru","New password")} name="next" type="password" autoComplete="new-password" minLength={admin?12:10} maxLength={128} required/>
      <button className={admin?primaryButton:outlineButton} disabled={pending}>{t("Simpan kata sandi","Save password")}</button>
      {message&&<p role="status" className={statusMessage}>{message}</p>}
    </form>
  </details>;
}
