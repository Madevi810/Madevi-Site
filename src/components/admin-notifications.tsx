"use client";

import { useEffect, useState } from "react";
import { adminPanel, adminTitle, eyebrow, fieldLabel, formLayout, inputControl, primaryButton, statusMessage, textAreaControl } from "./styles";
type User = {
  id: string;
  name: string;
  username: string | null;
};
export function AdminNotifications({}: {}) {
  const [audience, setAudience] = useState<"general" | "system">("general");
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({limit:"50", q:search});
      fetch(`/api/admin/users?${query}`, {cache:"no-store", signal:controller.signal})
        .then(r => r.ok ? r.json() : Promise.reject()).then(data => {if(!controller.signal.aborted)setUsers(data.users || [])})
        .catch(() => {if(!controller.signal.aborted) setUsers([])});
    }, 250);
    return () => {clearTimeout(timer);controller.abort()};
  }, [search]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          audience,
          title: String(f.get("title") || ""),
          body: String(f.get("body") || ""),
          ...(audience === "system" ? {
            recipientId: String(f.get("recipientId") || "")
          } : {})
        })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Gagal mengirim.");
      setMessage("Pemberitahuan dikirim.");
      setTitle("");
      setBody("");
      setRecipientId("");
      form.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pemberitahuan belum tersedia.");
    } finally {
      setPending(false);
    }
  }
  return <><p className={eyebrow}>ADMIN / NOTIFIKASI</p><div className={adminTitle}><div><h1>Notifikasi dan pesan</h1><p>Kirim pengumuman umum atau pesan sistem ke satu akun.</p></div></div><section className={adminPanel}><form className={formLayout} onSubmit={submit}><label className={fieldLabel}>Tujuan<select className={inputControl} value={audience} onChange={e => setAudience(e.target.value as "general" | "system")}><option value="general">Umum</option><option value="system">Pengguna tertentu</option></select></label>{audience === "system" && <label className={fieldLabel}>Akun<input className={inputControl} aria-label="Cari akun penerima" placeholder="Cari nama atau username" maxLength={100} value={search} onChange={e => {setSearch(e.target.value);setRecipientId("")}} /><select className={inputControl} name="recipientId" value={recipientId} onChange={e => setRecipientId(e.target.value)} required><option value="">Pilih akun</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}{u.username ? ` · @${u.username}` : ""}</option>)}</select></label>}<label className={fieldLabel}>Template<select className={inputControl} defaultValue="" onChange={e => {
            if (e.target.value === "update") {
              setTitle("Pembaruan Madevi");
              setBody("Informasi pembaruan akan disampaikan di sini.");
            } else if (e.target.value === "report") {
              setTitle("Tanggapan laporan");
              setBody("Terima kasih, laporan Anda sedang kami periksa.");
            }
          }}><option value="">Tulis sendiri</option><option value="update">Pembaruan Madevi</option><option value="report">Tanggapan laporan</option></select></label><label className={fieldLabel}>Judul<input className={inputControl} name="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required /></label><label className={fieldLabel}>Pesan<textarea className={textAreaControl} name="body" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={5} required /></label>{message && <p className={statusMessage} role="status">{message}</p>}<button className={primaryButton} disabled={pending}>{pending ? "Mengirim…" : "Kirim pemberitahuan"}</button></form></section></>;
}
