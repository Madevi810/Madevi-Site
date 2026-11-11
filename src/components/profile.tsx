"use client";

import { useEffect, useState } from "react";
import { UserRound, LogOut, MessageCircle, Bookmark, GraduationCap, ShoppingBag, History, ChevronRight, MapPin } from "lucide-react";
import { PhotoEditor } from "./photo-editor";
import { authClient } from "@/lib/auth-client";
import { Field } from "./ui";
import { SocialProfileSettings } from "./social-profile-settings";
import { profilePane, pillTabs, pillButton, pillActive, pillInactive, profileContent, profileLinks, logout, fineText, primaryButton, outlineButton, avatar, formLayout, fieldLabel, inputControl, statusMessage, textButton } from "./styles";
type View = "signin" | "signup" | "forgot" | "reset";
const PENDING_PHOTO = "madevi-pending-profile-photo";
export function Profile({
  english
}: {
  english: boolean;
}) {
  const {
    data: session,
    isPending,
    refetch
  } = authClient.useSession();
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [view, setView] = useState<View>("signin");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [profileView, setProfileView] = useState<"status" | "settings">("status");
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [google, setGoogle] = useState(false);
  const [complete, setComplete] = useState<boolean | null>(null);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);
  const [profileMeta, setProfileMeta] = useState<{username: string; city: string}>({username: "", city: ""});
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarMissing, setAvatarMissing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const t = (id: string, en: string) => english ? en : id;
  useEffect(() => {
    fetch("/api/features").then(r => r.json()).then(r => setGoogle(Boolean(r.google))).catch(() => setGoogle(false));
  }, []);
  useEffect(() => {
    if (!session?.user.id) {setComplete(null);setProfileLoadError(false);setProfileMeta({username:"",city:""});return;}
    let active = true;setComplete(null);setProfileLoadError(false);
    fetch("/api/account/profile",{cache:"no-store"}).then(r => {if(!r.ok)throw Error();return r.json()}).then(r => {
      if(typeof r.complete!=="boolean")throw Error();if(active){setComplete(r.complete);setProfileMeta({username: typeof r.profile?.username === "string" ? r.profile.username : "", city: typeof r.profile?.city === "string" ? r.profile.city : ""});}
    }).catch(() => {if(active)setProfileLoadError(true)});
    return () => {active=false};
  }, [session?.user.id, profileRetry]);
  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (!session?.user.email || !complete) return;
    let pending: {
      email: string;
      data: string;
      type: string;
      created: number;
    } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_PHOTO) || "null");
    } catch {
      return;
    }
    if (!pending) return;
    if (Date.now() - pending.created > 86400000) {
      sessionStorage.removeItem(PENDING_PHOTO);
      return;
    }
    if (pending.email.toLowerCase() !== session.user.email.toLowerCase()) return;
    let cancelled = false;
    const data = pending.data;
    const type = pending.type;
    void (async () => {
      try {
        const blob = await (await fetch(data)).blob();
        const body = new FormData();
        body.append("avatar", new File([blob], "profile", {
          type
        }));
        const response = await fetch("/api/account/avatar", {
          method: "POST",
          body
        });
        if (response.ok && !cancelled) {
          sessionStorage.removeItem(PENDING_PHOTO);
          setAvatarMissing(false);
          setAvatarVersion(Date.now());
        }
      } catch {/* user may retry in account settings */}
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.email, complete]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) || "").trim();
    if (view === "signup" && signupStep === 1) {
      if (get("password") !== get("confirm")) {setPasswordMismatch(true);return;}
      setPasswordMismatch(false);
      setSignupStep(2);
      return;
    }
    if (view === "signup" && photo && (photo.size > 1000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(photo.type))) {
      setMessage(t("Foto harus JPG, PNG, atau WebP dan maksimal 1 MB.", "Photo must be JPG, PNG, or WebP and at most 1 MB."));
      return;
    }
    setWorking(true);
    try {
      if (twoFactor) {
        const result = await authClient.twoFactor.verifyTotp({
          code: get("code"),
          trustDevice: false
        });
        if (result.error) throw new Error(t("Kode tidak valid.", "Invalid code."));
        setTwoFactor(false);
        await refetch();
      } else if (view === "signin") {
        const identity = get("identity");
        const password = get("password");
        const result = identity.includes("@") ? await authClient.signIn.email({
          email: identity,
          password
        }) : await authClient.signIn.username({
          username: identity,
          password
        });
        if (result.error) throw new Error(t("Akun atau kata sandi tidak sesuai, atau email belum diverifikasi.", "Invalid credentials or unverified email."));
        if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) setTwoFactor(true);else await refetch();
      } else if (view === "signup") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: get("username"),
            name: get("name"),
            birthDate: get("birthDate"),
            city: get("city"),
            email: get("email"),
            phone: get("phone"),
            password: get("password")
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("Pendaftaran belum berhasil.", "Could not register."));
        let saved = false;
        if (photo) {
          try {
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("photo"));
              reader.onload = () => resolve(String(reader.result));
              reader.readAsDataURL(photo);
            });
            sessionStorage.setItem(PENDING_PHOTO, JSON.stringify({
              email: get("email"),
              data,
              type: photo.type,
              created: Date.now()
            }));
            saved = true;
          } catch {/* prompt a retry after verification */}
        }
        setMessage(photo ? saved ? t("Periksa email untuk verifikasi. Foto akan dikirim setelah masuk di tab ini.", "Check your email. Your photo will upload after sign-in in this tab.") : t("Periksa email untuk verifikasi. Pilih ulang foto di pengaturan setelah masuk.", "Check your email. Choose your photo again after signing in.") : t("Periksa email untuk verifikasi akun.", "Check your email to verify your account."));
        setView("signin");setSignupStep(1);setPhoto(null);
      } else if (view === "forgot") {
        const email = get("email");
        const r = await fetch("/api/auth/email-otp/request-password-reset", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            email
          })
        });
        if (!r.ok) throw new Error(t("Permintaan belum berhasil. Coba lagi nanti.", "Request failed. Try again later."));
        setResetEmail(email);
        setView("reset");
        setMessage(t("Jika akun tersedia, kode dikirim melalui email.", "If the account exists, a code was sent by email."));
      } else {
        if (get("password") !== get("confirm")) throw new Error(t("Konfirmasi kata sandi tidak cocok.", "Passwords do not match."));
        const r = await fetch("/api/auth/email-otp/reset-password", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            email: resetEmail,
            otp: get("otp"),
            password: get("password")
          })
        });
        if (!r.ok) throw new Error(t("Kode tidak valid atau kedaluwarsa.", "Code is invalid or expired."));
        setView("signin");
        setMessage(t("Kata sandi diperbarui. Silakan masuk.", "Password updated. Sign in."));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Terjadi kesalahan.", "Something went wrong."));
    } finally {
      setWorking(false);
    }
  }
  const user = session?.user;
  if (isPending) return <p className="text-madevi-muted">{t("Memuat…", "Loading…")}</p>;
  if (session && profileLoadError) return <div className={profilePane}><div className={profileContent} role="alert"><p>{t("Profil belum dapat dimuat.","Profile could not be loaded.")}</p><button className={outlineButton} type="button" onClick={()=>setProfileRetry(value=>value+1)}>{t("Coba lagi","Try again")}</button></div><button className={logout} type="button" onClick={async()=>{await authClient.signOut();await refetch()}}><LogOut size={17}/>{t("Keluar","Sign out")}</button></div>;
  if (session && complete === null) return <p className="text-madevi-muted">{t("Memuat profil…", "Loading profile…")}</p>;
  if (session && !complete) return <div className={profilePane}><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          username: String(f.get("username") || ""),
          birthDate: String(f.get("birthDate") || "")
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || t("Gagal menyimpan.", "Could not save."));
        return;
      }
      setComplete(true);
      await refetch();
    }}><h3>{t("Lengkapi akun", "Complete your account")}</h3><Field label="Username" name="username" minLength={3} maxLength={30} required /><Field label={t("Tanggal lahir", "Date of birth")} name="birthDate" type="date" required />{message && <p className={statusMessage} role="alert">{message}</p>}<button className={`${primaryButton} w-full`}>{t("Simpan", "Save")}</button></form><button className={logout} onClick={async () => {
      await authClient.signOut();
      await refetch();
    }}><LogOut size={17} />{t("Keluar", "Sign out")}</button></div>;
  if (user && passwordRecovery) return <PasswordRecovery email={user.email} english={english} onBack={() => setPasswordRecovery(false)} />;
  if (user) return <div className={profilePane}><div className={pillTabs}><button className={`${pillButton} ${profileView === "status" ? pillActive : pillInactive}`} onClick={() => setProfileView("status")}>Status</button><button className={`${pillButton} ${profileView === "settings" ? pillActive : pillInactive}`} onClick={() => setProfileView("settings")}>{t("Pengaturan", "Settings")}</button></div><div className={profileContent}>{profileView === "status" ? <><div className="flex flex-col items-center text-center"><div className="grid h-madevi-92 w-madevi-92 place-items-center overflow-hidden rounded-full bg-madevi-soft">{avatarMissing ? <UserRound size={38} /> : <img className="h-full w-full object-cover" src={`/api/account/avatar?v=${avatarVersion}`} alt="" onError={() => setAvatarMissing(true)} />}</div><h3 className="mb-madevi-3 mt-madevi-14 text-madevi-18">{user.name}</h3>{profileMeta.username && <p className="m-0 text-madevi-muted">@{profileMeta.username}</p>}{profileMeta.city && <p className="mt-madevi-8 flex items-center gap-madevi-4 text-madevi-muted"><MapPin size={15} />{profileMeta.city}</p>}</div><div className="mt-madevi-20 flex flex-col gap-madevi-8">{([[t("Pesan", "Messages"), MessageCircle], [t("Daftar simpan", "Saved items"), Bookmark], [t("Belajar", "Learning"), GraduationCap], [t("Katalog belanja", "Shopping catalog"), ShoppingBag], [t("Riwayat", "History"), History]] as const).map(([label, Icon]) => <div key={label} className="flex w-full items-center gap-madevi-12 rounded-madevi-pill border border-madevi-line bg-madevi-surface px-madevi-15 py-madevi-9"><span className="grid h-madevi-35 w-madevi-35 place-items-center rounded-full bg-madevi-soft"><Icon size={18} /></span><strong className="flex-1">{label}</strong><span className="text-madevi-muted">{t("Belum tersedia", "Unavailable")}</span></div>)}</div></> : <ProfileSettings name={user.name} email={user.email} refetch={refetch} english={english} onProfileUpdate={meta => setProfileMeta(meta)} onReset={() => setPasswordRecovery(true)} onAvatar={() => {
        setAvatarMissing(false);
        setAvatarVersion(Date.now());
      }} />}</div><button className={logout} onClick={async () => {
      await authClient.signOut();
      await refetch();
    }}><LogOut size={17} />{t("Keluar", "Sign out")}</button></div>;
  return <div className={profilePane}><div className={pillTabs}><button className={`${pillButton} ${view !== "signup" ? pillActive : pillInactive}`} onClick={() => {
        setView("signin");
        setMessage("");
        setTwoFactor(false);
      }}>{t("Masuk", "Sign in")}</button><button className={`${pillButton} ${view === "signup" ? pillActive : pillInactive}`} onClick={() => {
        setView("signup");
        setSignupStep(1);
        setPasswordMismatch(false);
        setMessage("");
        setTwoFactor(false);
      }}>{t("Daftar", "Register")}</button></div><form className={formLayout} onSubmit={submit}>
    {view === "signup" && !twoFactor ? <><div className="text-center text-madevi-12 text-madevi-muted" aria-live="polite">{t(`Langkah ${signupStep} dari 2`, `Step ${signupStep} of 2`)} · {signupStep === 1 ? t("Akun", "Account") : t("Profil", "Profile")}</div><div hidden={signupStep !== 1} className={signupStep === 1 ? "flex flex-col gap-madevi-13" : "hidden"}><Field label="Username" name="username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.-]+" required={signupStep === 1} /><p className={fineText}>{t("Username tidak dapat diubah setelah akun dibuat.", "Username cannot be changed after account creation.")}</p><Field label="Email" name="email" type="email" required={signupStep === 1} /><Field label={t("Nomor telepon (opsional)", "Phone number (optional)")} name="phone" type="tel" /><Field label={t("Kata sandi", "Password")} name="password" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} minLength={10} autoComplete="new-password" required={signupStep === 1} /><Field label={t("Konfirmasi kata sandi", "Confirm password")} name="confirm" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} autoComplete="new-password" aria-invalid={passwordMismatch || undefined} aria-describedby={passwordMismatch ? "signup-password-error" : undefined} onChange={()=>setPasswordMismatch(false)} required={signupStep === 1} />{passwordMismatch && <p id="signup-password-error" role="alert" className={fineText}>{t("Konfirmasi kata sandi tidak cocok.","Passwords do not match.")}</p>}</div><div hidden={signupStep !== 2} className={signupStep === 2 ? "flex flex-col gap-madevi-13" : "hidden"}><PhotoEditor english={english} image={photoPreview} onFile={setPhoto} onRemove={() => setPhoto(null)} /><Field label={t("Nama lengkap", "Full name")} name="name" minLength={2} required={signupStep === 2} /><Field label={t("Tanggal lahir", "Date of birth")} name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} required={signupStep === 2} /><Field label={t("Kota asal", "City of origin")} name="city" maxLength={100} required={signupStep === 2} /><p className={fineText}>{t("Foto dikirim setelah verifikasi dan masuk di tab ini.", "Your photo uploads after verification and sign-in in this tab.")}</p></div></> : twoFactor ? <Field label={t("Kode autentikator", "Authenticator code")} name="code" autoComplete="one-time-code" required /> : view === "signin" ? <><Field label={t("Username atau email", "Username or email")} name="identity" autoComplete="username" required /><Field label={t("Kata sandi", "Password")} name="password" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} autoComplete="current-password" required /></> : view === "forgot" ? <Field label="Email" name="email" type="email" required /> : <><Field label={t("Kode OTP email", "Email OTP code")} name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /><Field label={t("Kata sandi baru", "New password")} name="password" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} minLength={10} autoComplete="new-password" required /><Field label={t("Konfirmasi kata sandi", "Confirm password")} name="confirm" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} autoComplete="new-password" required /></>}
    {message && <p className={statusMessage} role="status">{message}</p>}{view === "signup" && signupStep === 2 && <button type="button" className={`${outlineButton} w-full`} onClick={() => {
        setSignupStep(1);
        setMessage("");
      }}>{t("Kembali", "Back")}</button>}<button className={`${primaryButton} w-full`} disabled={working}>{working ? "…" : twoFactor ? t("Verifikasi", "Verify") : view === "signin" ? t("Masuk", "Sign in") : view === "signup" ? signupStep === 1 ? t("Lanjut", "Continue") : t("Buat akun", "Create account") : view === "reset" ? t("Atur ulang kata sandi", "Reset password") : t("Kirim kode OTP", "Send OTP code")}</button>
    
    {view !== "forgot" && view !== "reset" && !twoFactor && <><div className="text-center text-madevi-12 text-madevi-muted">{t("atau", "or")}</div><button type="button" className={`${outlineButton} w-full`} disabled={!google} onClick={() => void authClient.signIn.social({
          provider: "google",
          callbackURL: "/"
        })}>{t("Lanjutkan dengan Google", "Continue with Google")}</button>{!google && <p className={fineText}>{t("Google belum dikonfigurasi.", "Google is not configured.")}</p>}</>}
    {view === "signin" && <div className="flex items-center justify-center gap-madevi-12"><button className={textButton} type="button" onClick={() => {
          setView("forgot");
          setMessage("");
        }}>{t("Lupa password", "Forgot password")}</button><span>·</span><button className={textButton} type="button" onClick={() => {
          setView("forgot");
          setMessage("");
        }}>{t("Cari akun", "Find account")}</button></div>}{(view === "forgot" || view === "reset") && <button type="button" className={textButton} onClick={() => setView("signin")}>{t("Kembali masuk", "Back to sign in")}</button>}
  </form></div>;
}
function ProfileSettings({
  name,
  email,
  refetch,
  english,
  onAvatar,
  onReset,
  onProfileUpdate
}: {
  name: string;
  email: string;
  refetch: () => Promise<unknown>;
  english: boolean;
  onAvatar: () => void;
  onReset: () => void;
  onProfileUpdate: (meta: {username:string; city:string}) => void;
}) {
  const t = (id: string, en: string) => english ? en : id;
  const [value, setValue] = useState(name);
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [image, setImage] = useState(`/api/account/avatar?v=${Date.now()}`);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/account/profile", {
      cache: "no-store"
    }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => {
      if (d.profile) {
        setValue(d.profile.name || name);
        setBirthDate(d.profile.birthDate || "");
        setCity(d.profile.city || "");
        setPhone(d.profile.phone || "");
        setUsername(d.profile.username || "");
        onProfileUpdate({username:d.profile.username || "", city:d.profile.city || ""});
      }
    }).catch(() => setMessage(t("Profil belum tersedia.", "Profile unavailable.")));
  }, [name, english]);
  async function upload(file: File) {
    if (file.size > 1000000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage(t("Foto harus JPG, PNG, atau WebP maksimal 1 MB.", "Photo must be JPG, PNG, or WebP up to 1 MB."));
      return;
    }
    const data = new FormData();
    data.set("avatar", file);
    try {
    const r = await fetch("/api/account/avatar", {
      method: "POST",
      body: data
    });
    if (r.ok) {
      setImage(`/api/account/avatar?v=${Date.now()}`);
      setMissing(false);
      onAvatar();
      setMessage(t("Foto tersimpan.", "Photo saved."));
    } else setMessage(t("Foto belum tersimpan.", "Photo not saved."));
    } catch { setMessage(t("Foto belum tersimpan.", "Photo not saved.")); }
  }
  return <><PhotoEditor english={english} image={missing ? "" : image} onImageError={() => setMissing(true)} onFile={file => { void upload(file); }} onRemove={() => { void (async () => { try { const r = await fetch("/api/account/avatar", {method:"DELETE"}); if(r.ok){setMissing(true);onAvatar();setMessage(t("Foto dihapus.", "Photo removed."));} else setMessage(t("Foto belum dapat dihapus.", "Could not remove photo.")); } catch { setMessage(t("Foto belum dapat dihapus.", "Could not remove photo.")); } })(); }} /><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
      try {
      const r = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: value,
          birthDate,
          city,
          phone
        })
      });
      setMessage(r.ok ? t("Profil tersimpan.", "Profile saved.") : t("Profil belum tersimpan.", "Profile not saved."));
      if (r.ok) {onProfileUpdate({username,city}); await refetch();}
      } catch { setMessage(t("Profil belum tersimpan.", "Profile not saved.")); }
    }}><h3>{t("Pengaturan akun", "Account settings")}</h3><div className="flex flex-col gap-madevi-8">{([[t("Nama lengkap", "Full name"), "name"], [t("Tanggal lahir", "Date of birth"), "date"], [t("Kota asal", "City of origin"), "city"], [t("Nomor telepon (opsional)", "Phone (optional)"), "phone"]] as const).map(([label, key]) => <details key={key} className="rounded-madevi-20 border border-madevi-line bg-madevi-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-madevi-12 px-madevi-15 py-madevi-13 font-bold">{label}<ChevronRight size={17} /></summary><div className="px-madevi-15 pb-madevi-13"><Field label={label} type={key === "date" ? "date" : key === "phone" ? "tel" : "text"} value={key === "name" ? value : key === "date" ? birthDate : key === "city" ? city : phone} onChange={e => {const next=e.target.value;if(key === "name")setValue(next);else if(key === "date")setBirthDate(next);else if(key === "city")setCity(next);else setPhone(next);}} onInvalid={e => e.currentTarget.closest("details")?.setAttribute("open", "")} required={key !== "phone"} maxLength={key === "name" || key === "city" ? 100 : key === "phone" ? 30 : undefined} /></div></details>)}<div className="rounded-madevi-pill border border-madevi-line px-madevi-15 py-madevi-13 text-madevi-muted">Username {username && `· @${username}`} · {t("tidak dapat diubah", "cannot be changed")}</div></div><button className={`${primaryButton} w-full`}>{t("Simpan perubahan", "Save changes")}</button></form><SocialProfileSettings english={english} /><EmailChange currentEmail={email} english={english} onUpdated={refetch} /><button type="button" className={`${outlineButton} w-full`} onClick={onReset}>{t("Atur ulang kata sandi dengan email", "Reset password by email")}</button>{message && <p role="status">{message}</p>}</>;
}
function PasswordRecovery({
  email,
  english,
  onBack
}: {
  email: string;
  english: boolean;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [message, setMessage] = useState("");
  const t = (id: string, en: string) => english ? en : id;
  return <div className={profilePane}><h3>{t("Atur ulang kata sandi", "Reset password")}</h3><p className={fineText}>{t("Kode dikirim ke email akun yang terverifikasi.", "A code is sent to your verified account email.")}</p><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        if (stage === "request") {
          const r = await fetch("/api/auth/email-otp/request-password-reset", {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              email
            })
          });
          if (!r.ok) throw Error();
          setStage("reset");
          setMessage(t("Jika akun tersedia, kode dikirim melalui email.", "If the account exists, a code was sent by email."));
        } else {
          const password = String(f.get("password") || "");
          if (password !== String(f.get("confirm") || "")) {
            setMessage(t("Konfirmasi kata sandi tidak cocok.", "Passwords do not match."));
            return;
          }
          const r = await fetch("/api/auth/email-otp/reset-password", {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              email,
              otp: String(f.get("otp") || ""),
              password
            })
          });
          if (!r.ok) throw Error();
          setMessage(t("Kata sandi diperbarui. Silakan masuk kembali.", "Password updated. Sign in again."));
        }
      } catch {
        setMessage(t("Permintaan belum berhasil atau kode kedaluwarsa.", "Request failed or code expired."));
      }
    }}>{stage === "reset" && <><Field label={t("Kode OTP email", "Email OTP code")} name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /><Field label={t("Kata sandi baru", "New password")} name="password" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} minLength={10} required /><Field label={t("Konfirmasi kata sandi", "Confirm password")} name="confirm" type="password" revealLabels={{show:t("Tampilkan kata sandi","Show password"),hide:t("Sembunyikan kata sandi","Hide password")}} required /></>}{message && <p role="status" className={statusMessage}>{message}</p>}<button className={primaryButton}>{stage === "request" ? t("Kirim kode OTP", "Send OTP code") : t("Atur ulang kata sandi", "Reset password")}</button><button type="button" className={textButton} onClick={onBack}>{t("Kembali", "Back")}</button></form></div>;
}
function EmailChange({
  currentEmail,
  english,
  onUpdated
}: {
  currentEmail: string;
  english: boolean;
  onUpdated: () => Promise<unknown>;
}) {
  const [nextEmail, setNextEmail] = useState("");
  const [stage, setStage] = useState(false);
  const [message, setMessage] = useState("");
  const t = (id: string, en: string) => english ? en : id;
  return <details className="account-email-change"><summary>{t("Ubah email", "Change email")}</summary><p className={fineText}>{t("Email saat ini", "Current email")}: {currentEmail}</p><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const email = String(f.get("newEmail") || nextEmail).trim();
      try {
        const r = await fetch(stage ? "/api/auth/email-otp/change-email" : "/api/auth/email-otp/request-email-change", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(stage ? {
            newEmail: nextEmail,
            otp: String(f.get("otp") || "")
          } : {
            newEmail: email
          })
        });
        if (!r.ok) throw Error();
        if (stage) {
          setMessage(t("Email diperbarui.", "Email updated."));
          setStage(false);
          setNextEmail("");
          await onUpdated();
        } else {
          setNextEmail(email);
          setStage(true);
          setMessage(t("Jika dapat digunakan, kode dikirim ke email baru.", "If available, a code was sent to the new email."));
        }
      } catch {
        setMessage(t("Permintaan belum berhasil. Coba masuk kembali atau ulangi.", "Request failed. Sign in again or retry."));
      }
    }}><Field label={t("Email baru", "New email")} name="newEmail" type="email" value={nextEmail} onChange={e => setNextEmail(e.target.value)} disabled={stage} required={!stage} />{stage && <Field label={t("Kode OTP email baru", "New email OTP code")} name="otp" pattern="[0-9]{6}" inputMode="numeric" maxLength={6} required />}{message && <p role="status" className={statusMessage}>{message}</p>}<button className={outlineButton}>{stage ? t("Verifikasi email", "Verify email") : t("Kirim kode", "Send code")}</button>{stage && <button type="button" className={textButton} onClick={() => setStage(false)}>{t("Ubah alamat", "Change address")}</button>}</form></details>;
}
