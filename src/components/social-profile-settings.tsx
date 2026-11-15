"use client";

import { useEffect, useState } from "react";
import { fieldLabel, formLayout, inputControl, outlineButton, statusMessage, textAreaControl } from "./styles";
export function SocialProfileSettings({
  english
}: {
  english: boolean;
}) {
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("private");
  const [age, setAge] = useState("private");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const t = (id: string, en: string) => english ? en : id;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoaded(false);
    setLoadError(false);
    setMessage("");
    fetch('/api/account/social-profile', {
      cache: 'no-store', signal: controller.signal
    }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => {
      if (!d?.profile || typeof d.profile.bio !== "string" ||
          !["private", "friends"].includes(d.profile.city_visibility) ||
          !["private", "friends"].includes(d.profile.age_visibility)) throw Error();
      if (active) {
        setBio(d.profile.bio);
        setCity(d.profile.city_visibility);
        setAge(d.profile.age_visibility);
        setLoaded(true);
      }
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; controller.abort(); };
  }, [retry]);
  return <details className="account-email-change"><summary>{t("Profil sosial dan privasi", "Social profile and privacy")}</summary><p className="text-madevi-muted">{t("Pengaturan disiapkan untuk Madevi Line. Fitur sosial belum aktif.", "These settings prepare for Madevi Line. Social features are not active.")}</p><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
      if (!loaded || pending) return;
      setPending(true);
      setMessage("");
      try {
        const r = await fetch('/api/account/social-profile', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            bio,
            cityVisibility: city,
            ageVisibility: age
          })
        });
        setMessage(r.ok ? t("Pengaturan tersimpan.", "Settings saved.") : t("Pengaturan belum tersimpan.", "Settings not saved."));
      } catch {
        setMessage(t("Pengaturan belum tersimpan.", "Settings not saved."));
      } finally { setPending(false); }
    }}><label className={fieldLabel}>{t("Deskripsi diri", "About you")}<textarea className={textAreaControl} maxLength={500} disabled={!loaded || pending} value={bio} onChange={e => setBio(e.target.value)} /></label><label className={fieldLabel}>{t("Kota dapat dilihat", "Who can see your city")}<select className={inputControl} disabled={!loaded || pending} value={city} onChange={e => setCity(e.target.value)}><option value="private">{t("Hanya saya", "Only me")}</option><option value="friends">{t("Teman", "Friends")}</option></select></label><label className={fieldLabel}>{t("Umur dapat dilihat", "Who can see your age")}<select className={inputControl} disabled={!loaded || pending} value={age} onChange={e => setAge(e.target.value)}><option value="private">{t("Hanya saya", "Only me")}</option><option value="friends">{t("Teman", "Friends")}</option></select></label>{!loaded && <p role={loadError ? "alert" : "status"}>{loadError ? t("Pengaturan privasi belum dapat dimuat.", "Privacy settings could not be loaded.") : t("Memuat pengaturan privasi…", "Loading privacy settings…")}</p>}{loadError && <button type="button" className={outlineButton} onClick={() => setRetry(value => value + 1)}>{t("Coba lagi", "Try again")}</button>}{message && <p className={statusMessage} role="status">{message}</p>}<button className={outlineButton} disabled={!loaded || pending}>{pending ? t("Menyimpan…", "Saving…") : t("Simpan privasi", "Save privacy")}</button></form></details>;
}
