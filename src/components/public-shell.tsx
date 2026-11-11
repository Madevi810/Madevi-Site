"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Bell, Menu, Search, Settings, X, ArrowUpRight, Flag, UserRound, LogOut, Moon, Sun, Globe2 } from "lucide-react";
import { rooms, VERSION } from "@/lib/rooms";
import { Profile } from "./profile";
import { NotificationCenter } from "./notification-center";
import { Button, Dialog, StateMessage, useFocusTrap } from "./ui";
import { roundControl, roomPill, roomPillIcon, roomPillText, popup, popupTitle, popupRow, popupButton, formLayout, fieldLabel, inputControl, textAreaControl, statusMessage } from "./styles";
type SearchItem = {
  id: string;
  space: string;
  slug: string;
  title: string;
};
type Props = {
  page: "home" | "room" | "search" | "content";
  roomName?: string;
  query?: string;
  searchResults?: SearchItem[];
  searchError?: boolean;
  contentTitle?: string;
  paragraphs?: string[];
};
export function PublicShell({
  page,
  roomName,
  query,
  searchResults = [],
  searchError = false,
  contentTitle,
  paragraphs = []
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"menu" | "profile">("menu");
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [reportPreview, setReportPreview] = useState("");
  useEffect(() => {
    if (!reportPhoto) {
      setReportPreview("");
      return;
    }
    const url = URL.createObjectURL(reportPhoto);
    setReportPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [reportPhoto]);
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(open, drawerRef, () => setOpen(false));
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [english, setEnglish] = useState<boolean | null>(null);
  useEffect(() => {
    setTheme(localStorage.getItem("madevi-theme") === "dark" ? "dark" : "light");
    setEnglish(localStorage.getItem("madevi-lang") === "en");
  }, []);
  useEffect(() => {
    if (theme === null) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("madevi-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (english === null) return;
    document.documentElement.lang = english ? "en" : "id";
    localStorage.setItem("madevi-lang", english ? "en" : "id");
  }, [english]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSettings(false);
        setNotice(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) {
      setSettings(false);
      setNotice(false);
    }
  }, [open]);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && !target.closest("[data-popup-panel], [data-popup-toggle]")) {
        setSettings(false);
        setNotice(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove("is-reveal-waiting");
        observer.unobserve(entry.target);
      }
    }, {
      threshold: 0.12
    });
    for (const el of els) {
      const bounds = el.getBoundingClientRect();
      if (bounds.top >= window.innerHeight) {
        el.classList.add("is-reveal-waiting");
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, [page]);
  const t = (id: string, en: string) => english ? en : id;
  return <><header className="relative z-2 flex h-madevi-78 items-center justify-between gap-madevi-20 border-b border-madevi-line bg-madevi-surface px-madevi-topbar compact:h-madevi-68 compact:px-madevi-16"><Link className="flex items-center gap-madevi-11 whitespace-nowrap text-madevi-brand font-bold tracking-madevi-brand compact:text-madevi-brand-mobile" href="/"><span className="grid h-madevi-43 w-madevi-43 place-items-center rounded-madevi-13 bg-madevi-text text-madevi-24 font-bold text-madevi-surface compact:h-madevi-38-icon compact:w-madevi-38-icon compact:text-madevi-brand" aria-hidden="true">M</span><span>MADEVI</span></Link><div className="flex items-center gap-madevi-10 compact:gap-madevi-6"><form action="/cari" className="transition-[width,box-shadow] duration-250 ease-[ease] focus-within:w-madevi-search-focused focus-within:shadow-madevi-search-ring compact:focus-within:w-madevi-search-focused-mobile compact:focus-within:max-w-madevi-search-limit compact:focus-within:bg-madevi-surface motion-reduce:transition-none flex h-madevi-44 w-madevi-search items-center gap-madevi-9 rounded-madevi-50 border border-madevi-line bg-madevi-soft px-madevi-16 compact:h-madevi-40 compact:w-madevi-search-mobile compact:px-madevi-11"><Search size={18} /><input className="min-w-0 w-full border-0 bg-transparent text-madevi-text outline-none" name="q" placeholder={t("Cari di Madevi", "Search Madevi")} aria-label={t("Pencarian", "Search")} /></form><button className="grid h-madevi-43 w-madevi-43 flex-none place-items-center rounded-full border border-madevi-line bg-madevi-text text-madevi-surface" onClick={() => setOpen(true)} aria-label={t("Buka menu", "Open menu")}><Menu size={23} /></button></div></header>
    <main className="mx-auto max-w-madevi-main px-madevi-page pt-madevi-32 pb-madevi-70 compact:px-madevi-16 compact:pt-madevi-18 compact:pb-madevi-50">{page === "home" ? <><section className="grid min-h-madevi-420 grid-cols-1 gap-madevi-30 overflow-hidden rounded-madevi-27 bg-madevi-hero-bg p-madevi-hero-padding text-madevi-hero-text compact:min-h-0 compact:grid-cols-1 compact:p-madevi-30" style={{
          "--muted": "var(--madevi-hero-muted)"
        } as React.CSSProperties}><div><p className="text-madevi-micro font-bold tracking-madevi-eyebrow text-madevi-muted">EDUKASI DAN LAYANAN</p><h1 data-reveal className="opacity-100 [transform:translateY(0)] transition-[opacity,transform] duration-550 ease-[ease] [&.is-reveal-waiting]:opacity-0 [&.is-reveal-waiting]:[transform:translateY(var(--spacing-madevi-14))] motion-reduce:transition-none motion-reduce:[&.is-reveal-waiting]:opacity-100 motion-reduce:[&.is-reveal-waiting]:[transform:none] my-madevi-28 text-madevi-hero leading-madevi-hero tracking-madevi-hero compact:my-madevi-20">{t("Ruang untuk", "A space to")}<br /><em className="not-italic text-madevi-hero-accent">{t("terus belajar.", "keep learning.")}</em></h1><p className="mt-0 mb-madevi-26 max-w-madevi-description leading-madevi-description text-madevi-hero-description">{t("Pengetahuan, keterampilan, dan inspirasi dalam satu tempat.", "Knowledge, skills, and inspiration in one place.")}</p><Button onClick={() => {
              setTab("menu");
              setOpen(true);
            }}>{t("Jelajahi Madevi", "Explore Madevi")} <ArrowUpRight size={17} /></Button></div></section><section className="mt-madevi-65"><div className="mb-madevi-23 flex items-end justify-between gap-madevi-20 compact:flex-col compact:items-start"><div><p className="text-madevi-micro font-bold tracking-madevi-eyebrow text-madevi-muted">MADEVI</p><h2 data-reveal className="opacity-100 [transform:translateY(0)] transition-[opacity,transform] duration-550 ease-[ease] [&.is-reveal-waiting]:opacity-0 [&.is-reveal-waiting]:[transform:translateY(var(--spacing-madevi-14))] motion-reduce:transition-none motion-reduce:[&.is-reveal-waiting]:opacity-100 motion-reduce:[&.is-reveal-waiting]:[transform:none] my-madevi-10 text-madevi-title tracking-madevi-title">{t("Ruang Madevi", "Madevi spaces")}</h2></div><p className="text-madevi-muted compact:m-0">{t("Pilih ruang yang ingin Anda kunjungi.", "Choose a space to explore.")}</p></div><div className="grid grid-cols-4 gap-madevi-12 compact:grid-cols-2">{rooms.map((r, i) => <Link href={`/ruang/${r.slug}`} className="relative flex min-h-madevi-165 flex-col gap-madevi-15 rounded-madevi-20 border border-madevi-line bg-madevi-surface p-madevi-19 transition-[transform,border-color] duration-200 hover:border-madevi-space-hover hover:[transform:translateY(var(--madevi-card-lift))]" key={r.slug}><span className="text-madevi-small tracking-madevi-number text-madevi-muted">0{i + 1} / MADEVI</span><r.icon size={23} strokeWidth={1.6} /><strong className="max-w-madevi-space-name">{r.name}</strong><ArrowUpRight className="absolute bottom-madevi-20 right-madevi-20 text-madevi-muted" size={18} /></Link>)}</div></section></> : <section className="min-h-madevi-screen-70 pt-madevi-55"><p className="text-madevi-micro font-bold tracking-madevi-eyebrow text-madevi-muted">MADEVI / {page === "search" ? t("PENCARIAN", "SEARCH") : t("RUANG", "SPACE")}</p><h1 className="my-madevi-10 text-madevi-title tracking-madevi-title">{page === "search" ? t("Hasil pencarian", "Search results") : page === "content" ? contentTitle : roomName}</h1>{page === "search" && <p className="text-madevi-muted">{t("Pencarian", "Search")}: <strong>{query || "—"}</strong></p>}{page === "content" ? paragraphs.length ? paragraphs.map((text, i) => <p className="text-madevi-muted" key={i}>{text}</p>) : <StateMessage>{t("Materi belum tersedia.", "Material is not available yet.")}</StateMessage> : page === "search" && searchResults.length ? <div>{searchResults.map(item => <Link className={roomPill} key={item.id} href={`/baca/${item.space}/${item.slug}`}><strong className={roomPillText}>{item.title}</strong><ArrowUpRight className="text-madevi-muted" size={16} /></Link>)}</div> : <StateMessage kind={searchError ? "error" : "empty"}><Search size={24} /><p>{searchError ? t("Pencarian sementara tidak tersedia.", "Search is temporarily unavailable.") : page === "search" ? t("Belum ada hasil.", "No results yet.") : t("Ruang ini sedang disiapkan.", "This space is being prepared.")}</p></StateMessage>}<Link href="/" className="cursor-pointer border-0 bg-transparent p-madevi-6 text-madevi-muted">← {t("Kembali ke beranda", "Back to home")}</Link></section>}</main>
    <footer className="border-0 border-t border-solid border-madevi-line bg-madevi-surface px-madevi-page pt-madevi-42 pb-madevi-24 text-madevi-12 text-madevi-muted"><div className="flex flex-wrap justify-between gap-madevi-28"><div><strong className="text-madevi-16 text-madevi-text">MADEVI</strong><p className="m-0 mt-madevi-9">{t("Pengetahuan, panduan, dan layanan.", "Knowledge, guides, and services.")}</p></div><nav className="flex max-w-madevi-footer flex-wrap gap-x-madevi-22 gap-y-madevi-14" aria-label={t("Informasi Madevi", "Madevi information")}><Link href="/info/tentang">{t("Tentang Madevi", "About Madevi")}</Link><Link href="/info/privasi">{t("Kebijakan Privasi", "Privacy Policy")}</Link><Link href="/info/ketentuan">{t("Syarat dan Ketentuan", "Terms")}</Link><Link href="/info/bantuan">{t("Bantuan dan Kontak", "Help and Contact")}</Link><button type="button" className="border-0 bg-transparent p-0 text-inherit" onClick={() => {
            setTab("menu");
            setOpen(true);
            setReportOpen(true);
          }}>{t("Laporkan Masalah", "Report an issue")}</button><Link href="/admin">Admin</Link></nav></div><div className="mt-madevi-34 border-0 border-t border-solid border-madevi-line pt-madevi-17">Madevi © 2027</div></footer>
    {open && <div className="fixed inset-0 z-10"><button className="absolute inset-0 h-full w-full border-0 bg-madevi-backdrop backdrop-blur-madevi-backdrop" aria-label={t("Tutup menu", "Close menu")} onClick={() => setOpen(false)} /><aside ref={drawerRef} className="absolute top-0 right-0 bottom-0 flex w-madevi-drawer flex-col overflow-hidden rounded-l-madevi-18 bg-madevi-surface shadow-madevi animate-madevi-drawer compact:w-madevi-drawer-mobile" role="dialog" aria-modal="true" aria-label="Madevi"><div className="relative flex min-h-madevi-88 items-center justify-between gap-madevi-8 border-b border-madevi-line px-madevi-24 py-madevi-16 compact:min-h-madevi-76 compact:px-madevi-14 compact:py-madevi-13"><Link href="/" className="flex items-center gap-madevi-11 whitespace-nowrap text-madevi-drawer-brand font-bold tracking-madevi-brand compact:gap-madevi-7 compact:text-madevi-drawer-brand-mobile" onClick={() => setOpen(false)}><span className="grid h-madevi-43 w-madevi-43 place-items-center rounded-madevi-13 bg-madevi-text text-madevi-24 font-bold text-madevi-surface compact:h-madevi-35 compact:w-madevi-35 compact:text-madevi-brand">M</span><span>MADEVI<small className="mt-madevi-3 block text-madevi-small tracking-madevi-subtitle text-madevi-muted">RUANG ANDA</small></span></Link><div className="flex items-center gap-madevi-6 compact:gap-madevi-4"><button className={`${roundControl} !h-madevi-39 !w-madevi-39 compact:!h-madevi-34 compact:!w-madevi-34`} data-popup-toggle aria-label={t("Notifikasi", "Notifications")} aria-expanded={notice} onClick={() => {
              setNotice(!notice);
              setSettings(false);
            }}><Bell size={19} /></button><button className={`${roundControl} !h-madevi-39 !w-madevi-39 compact:!h-madevi-34 compact:!w-madevi-34`} data-popup-toggle aria-label={t("Pengaturan", "Settings")} aria-expanded={settings} onClick={() => {
              setSettings(!settings);
              setNotice(false);
            }}><Settings size={19} /></button><button className={`${roundControl} !h-madevi-39 !w-madevi-39 compact:!h-madevi-34 compact:!w-madevi-34`} aria-label={t("Tutup", "Close")} onClick={() => setOpen(false)}><X size={20} /></button></div>{settings && <div data-popup-panel className={popup}><strong className={popupTitle}>{t("Tampilan", "Appearance")}</strong><div className={popupRow}><button className={popupButton} onClick={() => {
                setTheme("light");
                setSettings(false);
              }}><Sun size={15} /> {t("Terang", "Light")}</button><button className={popupButton} onClick={() => {
                setTheme("dark");
                setSettings(false);
              }}><Moon size={15} /> {t("Gelap", "Dark")}</button></div><strong className={popupTitle}><Globe2 size={15} /> {t("Bahasa", "Language")}</strong><div className={popupRow}><button className={popupButton} onClick={() => {
                setEnglish(false);
                setSettings(false);
              }}>Indonesia</button><button className={popupButton} onClick={() => {
                setEnglish(true);
                setSettings(false);
              }}>English</button></div></div>}{notice && <div data-popup-panel className={popup}><NotificationCenter english={Boolean(english)} onClose={() => setNotice(false)} /></div>}</div>
      <div className="flex flex-none justify-center px-madevi-24 pt-madevi-16 compact:px-madevi-15"><div className="flex w-full rounded-madevi-pill bg-madevi-soft p-madevi-4"><button className={`flex-1 rounded-madevi-pill border-0 px-madevi-23 py-madevi-9 font-bold ${tab === "menu" ? "bg-madevi-surface text-madevi-text shadow-madevi-tab" : "bg-transparent text-madevi-muted"}`} onClick={() => setTab("menu")}>Menu</button><button className={`flex-1 rounded-madevi-pill border-0 px-madevi-23 py-madevi-9 font-bold ${tab === "profile" ? "bg-madevi-surface text-madevi-text shadow-madevi-tab" : "bg-transparent text-madevi-muted"}`} onClick={() => setTab("profile")}>{t("Profil", "Profile")}</button></div></div>
      {tab === "menu" ? <div className="flex min-h-0 flex-1 flex-col px-madevi-24 pt-madevi-20 compact:px-madevi-15 short:pt-madevi-12"><h3 className="mt-0 mb-madevi-12 text-madevi-15">{t("Ruang Madevi", "Madevi spaces")}</h3><nav className="min-h-0 flex-1 overflow-auto pb-madevi-12" aria-label="Ruang Madevi">{rooms.map(r => <Link key={r.slug} href={`/ruang/${r.slug}`} onClick={() => setOpen(false)} className={roomPill} style={{
              "--accent": r.color
            } as React.CSSProperties}><span className={roomPillIcon}><r.icon size={19} /></span><strong className={roomPillText}>{r.name}</strong><ArrowUpRight className="text-madevi-muted" size={16} /></Link>)}</nav><div className="flex-none pb-madevi-16 pt-madevi-8"><div className="grid grid-cols-(--madevi-developer-grid) gap-madevi-14 rounded-madevi-20 border border-madevi-line p-madevi-16 compact:grid-cols-(--madevi-developer-grid-mobile) compact:gap-madevi-10 compact:p-madevi-12 short:grid-cols-(--madevi-developer-grid-short) short:p-madevi-10"><img className="h-madevi-60 w-madevi-60 rounded-madevi-15 object-cover compact:h-madevi-50 compact:w-madevi-50 short:h-madevi-42 short:w-madevi-42" src="/images/developer-art.png" alt="" /><div><strong className="block text-madevi-13 compact:text-madevi-11">PLATFORM MADEVI</strong><span className="mt-madevi-4 block text-madevi-11 text-madevi-muted">Patch {VERSION}</span><small className="mt-madevi-4 block text-madevi-11 text-madevi-muted">{t("Ikuti Developer", "Follow Developer")}</small></div><div className="col-span-2 flex justify-center gap-madevi-22 compact:gap-madevi-20 short:gap-madevi-18"><span role="img" className="grid h-madevi-28 w-madevi-28 place-items-center text-madevi-text" aria-label="TikTok"><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M16.6 1c.3 2.4 1.7 3.8 4 4v3.1a8.5 8.5 0 0 1-4-1.1v7.2c0 4.8-2.7 7-6.1 7-3.1 0-5.5-2.1-5.5-5.3 0-3.1 2.4-5.6 6.1-5.4v3.2c-1.8-.3-3 .7-3 2.2 0 1.3 1 2.2 2.2 2.2 1.7 0 2.8-1 2.8-3.9V1h3.5Z" /></svg></span><span role="img" className="grid h-madevi-28 w-madevi-28 place-items-center text-madevi-text" aria-label="Instagram"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg></span><span role="img" className="grid h-madevi-28 w-madevi-28 place-items-center text-madevi-text" aria-label="YouTube"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></svg></span></div></div><button className="mt-madevi-12 flex h-madevi-47 w-full items-center justify-center gap-madevi-9 rounded-madevi-50 border-0 bg-madevi-soft font-bold short:h-madevi-38" onClick={() => {
              setReportOpen(true);
              setReportMessage("");
            }}><Flag size={16} />{t("Laporkan Masalah", "Report an issue")}</button></div></div> : <Profile english={Boolean(english)} />} {reportOpen && <Dialog title={t("Laporkan Masalah", "Report an issue")} onClose={() => setReportOpen(false)}><div className="flex items-center justify-between"><h3 id="report-title">{t("Laporkan Masalah", "Report an issue")}</h3><button className={roundControl} onClick={() => setReportOpen(false)} aria-label={t("Tutup", "Close")}><X size={18} /></button></div><form className={formLayout} onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            try {
              const r = await fetch("/api/report", {
                method: "POST",
                body: f
              });
              const data = await r.json();
              setReportMessage(r.ok ? t("Laporan berhasil dikirim.", "Report sent.") : data.error || t("Gagal mengirim laporan.", "Could not send report."));
              if (r.ok) {
                form.reset();
                setReportPhoto(null);
              }
            } catch {
              setReportMessage(t("Gagal mengirim laporan.", "Could not send report."));
            }
          }}><label className={fieldLabel}>{t("Ceritakan masalahnya", "Describe the issue")}<textarea className={textAreaControl} name="message" minLength={10} maxLength={1000} required rows={6} /></label><label className={fieldLabel}>{t("Tautan terkait (opsional)", "Related link (optional)")}<input className={inputControl} name="url" type="url" maxLength={2048} /></label><label className={fieldLabel}>{t("Foto bukti (opsional, maks. 2 MB)", "Photo (optional, max 2 MB)")}<input className={inputControl} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setReportPhoto(e.target.files?.[0] || null)} /></label>{reportPreview && <img src={reportPreview} alt={t("Pratinjau bukti", "Evidence preview")} className="max-h-madevi-160 max-w-full rounded-madevi-12 object-contain" />}{reportMessage && <p role="status" className={statusMessage}>{reportMessage}</p>}<Button className="w-full">{t("Kirim laporan", "Send report")}</Button></form></Dialog>}</aside></div>}</>;
}
