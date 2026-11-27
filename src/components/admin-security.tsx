"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AccountPassword, SessionManager } from "./session-manager";
import { EmailChange } from "./profile";
import { Field } from "./ui";
import { authScreen, authCard, authMark, formLayout, fieldLabel, inputControl, primaryButton, textButton, fineText, recoveryBlock } from "./styles";
export function AdminSecurity({enabled,email}:{enabled:boolean;email:string}){
  const [interactive,setInteractive]=useState(false);
  useEffect(()=>setInteractive(true),[]);
  const [secret,setSecret]=useState("");const [codes,setCodes]=useState<string[]>([]);const [message,setMessage]=useState("");
  return <main className={authScreen}><div className={authCard}><div className={authMark}>M</div><h1>Keamanan Admin</h1>{enabled?<><p>Autentikator telah aktif.</p>
    <p className={fineText}>Untuk perubahan identitas dan kode pemulihan, masuk ulang dengan MFA lalu lanjutkan dalam lima menit. Penggantian autentikator memakai prosedur operator host.</p>
    <SessionManager/><AccountPassword admin/><EmailChange currentEmail={email} english={false} onUpdated={async()=>{location.assign("/admin");}}/>
    <details><summary>Buat ulang kode pemulihan</summary>
      <form method="post" className={formLayout} onSubmit={async event=>{
        event.preventDefault();
        const form=event.currentTarget;
        const password=String(new FormData(form).get("password")||"");
        form.reset();setMessage("");setCodes([]);
        try {
          const result=await authClient.twoFactor.generateBackupCodes({password});
          if(result.error||!result.data?.backupCodes){setMessage("Masuk ulang dengan MFA dan periksa kata sandi.");return;}
          setCodes(result.data.backupCodes);
        }catch{setMessage("Status penyiapan kode belum dapat diperiksa.");}
      }}>
        <Field label="Kata sandi untuk kode pemulihan" name="password" type="password" autoComplete="current-password" maxLength={128} required/>
        <button className={primaryButton}>Ganti kode dan cabut sesi lain</button>
      </form>
      {codes.length>0&&<><p>Simpan kode sekali pakai pada tempat privat.</p><div className={recoveryBlock}>{codes.map(code=><div key={code}>{code}</div>)}</div>
        <button type="button" className={textButton} onClick={()=>setCodes([])}>Tutup kode</button></>}
      {message&&<p role="status">{message}</p>}
    </details>
    </>:<><p>Siapkan aplikasi autentikator dan simpan kode pemulihan di tempat aman.</p>{!secret?<form method="post" className={formLayout} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const result=await authClient.twoFactor.enable({password:String(f.get("password")||""),method:"totp"});if(result.error||!result.data||result.data.method!=="totp"){setMessage("Tidak dapat menyiapkan autentikator.");return}setSecret(new URL(result.data.totpURI).searchParams.get("secret")||"");setCodes(result.data.backupCodes)}}><Field label="Kata sandi" name="password" type="password" required autoComplete="current-password"/><button disabled={!interactive} className={`${primaryButton} w-full`}>Siapkan autentikator</button></form>:<><p className={fineText}>Masukkan kunci ini secara manual di aplikasi autentikator. Jangan bagikan kepada siapa pun.</p><p className={recoveryBlock}>{secret}</p><p>Catat kode pemulihan berikut. Masing-masing hanya dapat digunakan sekali.</p><div className={recoveryBlock}>{codes.map(x=><div key={x}>{x}</div>)}</div><form method="post" className={formLayout} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const result=await authClient.twoFactor.verifyTotp({code:String(f.get("code")||""),trustDevice:false});if(result.error){setMessage("Kode belum sesuai.");return}setSecret("");setCodes([]);window.location.href="/admin"}}><label className={fieldLabel}>Kode autentikator<input className={inputControl} name="code" required autoComplete="one-time-code"/></label><button disabled={!interactive} className={`${primaryButton} w-full`}>Aktifkan</button></form></>}{message&&<p role="alert">{message}</p>}</>}<Link href="/admin" className={textButton}>← Kembali</Link></div></main>;
}
