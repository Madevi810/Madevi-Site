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
  const t = (id: string, en: string) => english ? en : id;
  useEffect(() => {
    fetch('/api/account/social-profile', {
      cache: 'no-store'
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.profile) {
        setBio(d.profile.bio || '');
        setCity(d.profile.city_visibility);
        setAge(d.profile.age_visibility);
      }
    }).catch(() => {});
  }, []);
  return <details className="account-email-change"><summary>{t("Profil sosial dan privasi", "Social profile and privacy")}</summary><p className="text-madevi-muted">{t("Pengaturan disiapkan untuk Madevi Line. Fitur sosial belum aktif.", "These settings prepare for Madevi Line. Social features are not active.")}</p><form className={formLayout} onSubmit={async e => {
      e.preventDefault();
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
      }
    }}><label className={fieldLabel}>{t("Deskripsi diri", "About you")}<textarea className={textAreaControl} maxLength={500} value={bio} onChange={e => setBio(e.target.value)} /></label><label className={fieldLabel}>{t("Kota dapat dilihat", "Who can see your city")}<select className={inputControl} value={city} onChange={e => setCity(e.target.value)}><option value="private">{t("Hanya saya", "Only me")}</option><option value="friends">{t("Teman", "Friends")}</option></select></label><label className={fieldLabel}>{t("Umur dapat dilihat", "Who can see your age")}<select className={inputControl} value={age} onChange={e => setAge(e.target.value)}><option value="private">{t("Hanya saya", "Only me")}</option><option value="friends">{t("Teman", "Friends")}</option></select></label>{message && <p className={statusMessage} role="status">{message}</p>}<button className={outlineButton}>{t("Simpan privasi", "Save privacy")}</button></form></details>;
}
