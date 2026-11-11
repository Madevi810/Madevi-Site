"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Field } from "./ui";
import {authScreen,authCard,authMark,eyebrow,statusMessage,formLayout,fieldLabel,inputControl,primaryButton,textButton} from "./styles";

export function AdminLogin({ needsMfa }: { needsMfa: boolean }) {
  const [message,setMessage]=useState(""); const [code,setCode]=useState(false); const [backup,setBackup]=useState(false); const [pending,setPending]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");setPending(true);const f=new FormData(event.currentTarget);
    try {
      if(code) { const result=backup ? await authClient.twoFactor.verifyBackupCode({code:String(f.get("code") || ""),trustDevice:false}) : await authClient.twoFactor.verifyTotp({code:String(f.get("code") || ""),trustDevice:false});if(result.error) throw new Error("Kode tidak sesuai.");window.location.href="/admin";return; }
      const identity=String(f.get("identity")||"").trim();const password=String(f.get("password")||"");
      const result=identity.includes("@") ? await authClient.signIn.email({email:identity,password}) : await authClient.signIn.username({username:identity,password});
      if(result.error) throw new Error("Akun atau kata sandi tidak sesuai.");
      if(result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect){setCode(true);return;}
      window.location.href="/admin";
    } catch(error){setMessage(error instanceof Error?error.message:"Tidak dapat masuk.");} finally{setPending(false);}
  }
  return <main className={authScreen}><div className={authCard}><div className={authMark}>M</div><p className={eyebrow}>ADMIN MADEVI</p><h1>Masuk Admin</h1>{needsMfa && <p className={statusMessage}>Autentikator admin belum diaktifkan. <Link href="/admin/security">Siapkan autentikator</Link></p>}<form onSubmit={submit} className={formLayout}>{code ? <label className={fieldLabel}><span>{backup?"Kode pemulihan":"Kode autentikator"}</span><input className={inputControl} name="code" required autoComplete="one-time-code"/></label> : <><label className={fieldLabel}><span>Username atau email</span><input className={inputControl} name="identity" required autoComplete="username"/></label><Field label="Kata sandi" name="password" type="password" required autoComplete="current-password"/></>}{message&&<p className={statusMessage} role="alert">{message}</p>}<button disabled={pending} className={`${primaryButton} w-full`}>{pending?"…":code?"Verifikasi":"Masuk"}</button>{code&&<button type="button" className={textButton} onClick={()=>setBackup(!backup)}>{backup?"Gunakan kode autentikator":"Gunakan kode pemulihan"}</button>}</form></div></main>;
}

