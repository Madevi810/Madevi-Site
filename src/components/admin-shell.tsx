"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Activity, Bell, Database, FileText, LayoutDashboard, Menu, Search, Settings, ShieldCheck, UserRound, Users, X, LogOut, ArrowUpRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useFocusTrap } from "./ui";
import { AdminContent } from "./admin-content";
import { AdminNotifications } from "./admin-notifications";
import { AdminSystem } from "./admin-system";
import { NotificationCenter } from "./notification-center";
import { topBar, brand, brandMark, headerRight, adminSearch, searchInput, roundControl, popup, popupTitle, popupRow, popupButton, drawerLayer, backdrop, drawer, drawerHeader, drawerBrand, drawerBrandMark, adminMain, eyebrow, adminTitle, adminGrid, adminStat, adminPanel, adminRow, userRow, avatar, adminMenu, adminLogout, roomPill, roomPillText, fieldLabel, inputControl, statusMessage, textButton } from "./styles";
import { rooms, VERSION } from "@/lib/rooms";
type ReportRow = {
  id: string | number;
  body: string;
  created_at: string;
  reference_url: string | null;
  status: string;
  has_image: boolean;
};
type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  emailVerified: boolean;
  suspended: boolean;
  createdAt: string;
};
export function AdminShell({
  name,
  profile = false,
  email = "",
  username = ""
}: {
  name: string;
  profile?: boolean;
  email?: string;
  username?: string;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"dashboard" | "users" | "reports" | "content" | "notifications" | "system">("dashboard");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportPage, setReportPage] = useState(1);
  const [reportHasNext, setReportHasNext] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userHasNext, setUserHasNext] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userRefresh, setUserRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState(false);
  const [newReports, setNewReports] = useState<"checking" | "new" | "none" | "unavailable">("checking");
  const [profileName, setProfileName] = useState(name);
  const [dbStatus, setDbStatus] = useState("Memeriksa");
  useEffect(() => {
    if (!profile && new URLSearchParams(window.location.search).get("panel") === "reports") setPanel("reports");
  }, [profile]);
  useEffect(() => {
    if (!notice) return;
    const controller = new AbortController();
    setNewReports("checking");
    fetch("/api/admin/reports?status=new&limit=1", {cache:"no-store",signal:controller.signal})
      .then(r => {if(!r.ok)throw Error();return r.json()})
      .then(data => {if(!controller.signal.aborted)setNewReports(data.reports?.length ? "new" : "none")})
      .catch(() => {if(!controller.signal.aborted)setNewReports("unavailable")});
    return () => controller.abort();
  }, [notice]);
  useEffect(() => {
    const t = localStorage.getItem("madevi-theme");
    document.documentElement.dataset.theme = t === "dark" ? "dark" : "light";
  }, []);
  useEffect(() => {
    if (profile || panel !== "dashboard") return;
    let active = true;
    fetch("/api/health/ready", {
      cache: "no-store"
    }).then(r => {
      if (active) setDbStatus(r.ok ? "Terhubung" : "Belum siap");
    }).catch(() => {
      if (active) setDbStatus("Belum siap");
    });
    return () => {
      active = false;
    };
  }, [panel, profile]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettings(false);
        setNotice(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-admin-popup-panel], [data-admin-popup-toggle]")) {
        setSettings(false);
        setNotice(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(open, drawerRef, () => setOpen(false));
  useEffect(() => {
    if (panel !== "users" || profile) return;
    const controller = new AbortController();
    setUserLoading(true);
    setUsers([]);
    setUserHasNext(false);
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ page: String(userPage), limit: "50", q: filter });
        const response = await fetch(`/api/admin/users?${query}`, {cache:"no-store", signal:controller.signal});
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setUsers(data.users); setUserHasNext(Boolean(data.pagination?.hasNext)); setMessage(""); }
      } catch { if (!controller.signal.aborted) { setUsers([]); setUserHasNext(false); setMessage("Data pengguna belum tersedia."); } }
      finally { if (!controller.signal.aborted) setUserLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [panel, profile, userPage, filter, userRefresh]);
  useEffect(() => {
    if (panel !== "reports" || profile) return;
    const controller = new AbortController();
    setReportLoading(true);
    setReports([]);
    setReportHasNext(false);
    const query = new URLSearchParams({page:String(reportPage),limit:"50"});
    fetch(`/api/admin/reports?${query}`, {cache:"no-store",signal:controller.signal})
      .then(r => {if(!r.ok)throw Error();return r.json()})
      .then(data => {if(!controller.signal.aborted){setReports(data.reports || []);setReportHasNext(Boolean(data.pagination?.hasNext));setMessage("")}})
      .catch(() => {if(!controller.signal.aborted){setReports([]);setReportHasNext(false);setMessage("Laporan belum tersedia.")}})
      .finally(() => {if(!controller.signal.aborted)setReportLoading(false)});
    return () => controller.abort();
  }, [panel, profile, reportPage]);
  async function updateReport(id: string | number, status: string) {
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH", headers: {"content-type":"application/json"}, body: JSON.stringify({id:Number(id),status})
      });
      if (!response.ok) throw Error();
      setReports(current => current.map(item => String(item.id) === String(id) ? {...item,status} : item));
      setMessage("Status laporan diperbarui.");
    } catch { setMessage("Status laporan belum tersimpan."); }
  }
  async function change(id: string, action: "block" | "restore") {
    if (!window.confirm(action === "block" ? "Blokir akun ini?" : "Pulihkan akun ini?")) return;
    try {
      const response = await fetch("/api/admin/users", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,action})
      });
      if (!response.ok) throw Error();
      setUserRefresh(value => value + 1);
    } catch { setMessage("Gagal mengubah akun."); }
  }
  return <><header className={`${topBar} compact:gap-madevi-6 narrow:px-madevi-12`}><Link className={`${brand} compact:gap-madevi-7 compact:text-madevi-drawer-brand-mobile narrow:gap-madevi-4 narrow:text-madevi-11`} href="/admin"><span className={`${brandMark.replace("compact:h-madevi-38-icon", "").replace("compact:w-madevi-38-icon", "").replace("compact:text-madevi-brand", "")} compact:h-madevi-32 compact:w-madevi-32 compact:text-madevi-brand-mobile narrow:h-madevi-28-icon narrow:w-madevi-28-icon narrow:text-madevi-drawer-brand-mobile`}>M</span><span>ADMIN MADEVI</span></Link><div className={`${headerRight.replace("compact:gap-madevi-6", "")} compact:gap-madevi-4`}><div className={`${adminSearch.replace("compact:w-madevi-admin-search", "")} compact:w-madevi-60 narrow:w-madevi-35`}><Search size={18} /><input className={searchInput} aria-label="Cari pengguna" placeholder="Cari pengguna" value={filter} onChange={e => {
            setFilter(e.target.value);
            setUserPage(1);
            setPanel("users");
          }} /></div><button className={`${roundControl} compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`} data-admin-popup-toggle aria-label="Notifikasi" aria-expanded={notice} onClick={() => {
          setNotice(!notice);
          setSettings(false);
        }}><Bell size={18} /></button><button className={`${roundControl} compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`} data-admin-popup-toggle aria-label="Pengaturan" aria-expanded={settings} onClick={() => {
          setSettings(!settings);
          setNotice(false);
        }}><Settings size={18} /></button><Link className={`${roundControl} compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`} href="/admin/profile" aria-label="Profil admin"><UserRound size={18} /></Link><button className={`${roundControl} compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`} aria-label="Menu admin" onClick={() => setOpen(true)}><Menu size={20} /></button>{notice && <div data-admin-popup-panel className={popup}><NotificationCenter english={false} onClose={() => setNotice(false)} /><div className="border-0 border-t border-solid border-madevi-line pt-madevi-12"><p role="status">{newReports === "checking" ? "Memeriksa laporan…" : newReports === "new" ? "Ada laporan baru." : newReports === "none" ? "Tidak ada laporan baru." : "Status laporan belum tersedia."}</p><button type="button" className={textButton} onClick={() => {setNotice(false);if(profile)window.location.href="/admin?panel=reports";else setPanel("reports")}}>Buka laporan</button></div></div>}{settings && <div data-admin-popup-panel className={popup}><strong className={popupTitle}>Tema</strong><div className={popupRow}><button className={popupButton} onClick={() => {
              document.documentElement.dataset.theme = "light";
              localStorage.setItem("madevi-theme", "light");
              setSettings(false);
            }}>Terang</button><button className={popupButton} onClick={() => {
              document.documentElement.dataset.theme = "dark";
              localStorage.setItem("madevi-theme", "dark");
              setSettings(false);
            }}>Gelap</button></div></div>}</div></header>
  <main className={adminMain}>{profile ? <><p className={eyebrow}>ADMIN / PROFIL</p><div className={adminTitle}><div><h1>Profil Admin</h1><p>Informasi akun admin MADEVI</p></div></div><section className={`${adminPanel} flex items-center gap-madevi-20 [&_p]:text-madevi-muted`}><div className={avatar}><UserRound size={28} /></div><form onSubmit={async e => {
            e.preventDefault();
            const r = await authClient.updateUser({
              name: profileName
            });
            setMessage(r.error ? "Gagal menyimpan profil." : "Profil tersimpan.");
          }}><label className={fieldLabel}>Nama lengkap<input className={inputControl} value={profileName} onChange={e => setProfileName(e.target.value)} maxLength={100} required /></label><p>{username} · {email}</p><button className="inline-flex min-h-madevi-43 items-center justify-center gap-madevi-8 rounded-madevi-pill border border-madevi-text bg-madevi-text px-madevi-20 font-bold text-madevi-surface">Simpan perubahan</button>{message && <p role="status">{message}</p>}</form></section><Link className={textButton} href="/admin">← Kembali ke dashboard</Link></> : panel === "dashboard" ? <><div className={adminTitle}><div><h1>Dashboard</h1><p>Gambaran keseluruhan website</p></div><span className="rounded-madevi-30 bg-madevi-soft px-madevi-12 py-madevi-8 text-madevi-11">{VERSION}</span></div><div className={adminGrid}>{[["Pengguna", "—", Users, "users"], ["Laporan", "—", FileText, "reports"], ["Konten", "—", LayoutDashboard, "content"], ["Status sistem", dbStatus, Database, "system"]].map(([label, value, Icon, target]) => <button type="button" className={`${adminStat} text-left`} key={String(label)} onClick={() => setPanel(target as "users" | "reports" | "content" | "system")}><Icon size={21} /><p>{String(label)}</p><strong>{String(value)}</strong></button>)}</div><section className={adminPanel}><h2>Aktivitas terbaru</h2><p className="text-madevi-muted">Aktivitas belum tersedia.</p></section><section className={adminPanel}><h2>Ruang Madevi</h2>{rooms.map(r => <div className={adminRow} key={r.slug}><span><r.icon size={17} /> {r.name}</span><span className="text-madevi-muted">Belum diisi</span></div>)}</section></> : panel === "content" ? <AdminContent /> : panel === "notifications" ? <AdminNotifications /> : panel === "system" ? <AdminSystem /> : panel === "reports" ? <><p className={eyebrow}>ADMIN / LAPORAN</p><div className={adminTitle}><div><h1>Laporan Masalah</h1><p>Laporan yang dikirim pengunjung</p></div></div>{message && <p role="status" className={statusMessage}>{message}</p>}<section className={adminPanel}>{reports.length ? reports.map(r => <div className={adminRow} key={r.id}><span><span>{r.body}{r.reference_url && <> · <a href={r.reference_url} target="_blank" rel="noopener noreferrer">Tautan terkait</a></>}{r.has_image && <> · <a href={`/api/admin/reports/${r.id}/image`} target="_blank" rel="noopener noreferrer">Lihat foto</a></>}</span></span><span className="flex items-center gap-madevi-12"><span>{new Date(r.created_at).toLocaleDateString("id-ID")}</span><select className="min-h-madevi-38 rounded-madevi-10 border border-madevi-line bg-madevi-surface px-madevi-9 text-madevi-12 text-madevi-text" aria-label="Status laporan" value={r.status} onChange={e => void updateReport(r.id, e.target.value)}><option value="new">Baru</option><option value="in_progress">Diperiksa</option><option value="resolved">Selesai</option><option value="spam">Spam</option></select></span></div>) : <p className="text-madevi-muted">{reportLoading ? "Memuat laporan…" : "Belum ada laporan."}</p>}<div className="mt-madevi-12 flex items-center gap-madevi-12" aria-label="Halaman laporan"><button className={textButton} type="button" disabled={reportPage === 1 || reportLoading} onClick={() => setReportPage(page => page - 1)}>Sebelumnya</button><span aria-live="polite">Halaman {reportPage}</span><button className={textButton} type="button" disabled={!reportHasNext || reportLoading} onClick={() => setReportPage(page => page + 1)}>Berikutnya</button></div></section></> : <><p className={eyebrow}>ADMIN / AKUN</p><div className={adminTitle}><div><h1>Pengguna</h1><p>Kelola akun Madevi</p></div></div>{message && <p role="status" className={statusMessage}>{message}</p>}<section className={adminPanel}><div className="w-full">{users.map(u => <div key={u.id} className={userRow}><div><strong>{u.name}</strong><p>{u.username || "—"} · {u.email}</p><span className="text-madevi-muted">{u.suspended ? "Diblokir" : u.emailVerified ? "Aktif" : "Belum terverifikasi"}</span></div><button className="inline-flex min-h-madevi-43 items-center justify-center gap-madevi-8 rounded-madevi-pill border border-madevi-text bg-transparent px-madevi-20 font-bold text-madevi-text" onClick={() => change(u.id, u.suspended ? "restore" : "block")}>{u.suspended ? "Pulihkan" : "Blokir"}</button></div>)}{!users.length && <p className="text-madevi-muted">{userLoading ? "Memuat pengguna…" : "Tidak ada pengguna yang sesuai."}</p>}</div><div className="mt-madevi-12 flex items-center gap-madevi-12" aria-label="Halaman pengguna"><button className={textButton} type="button" disabled={userPage === 1 || userLoading} onClick={() => setUserPage(page => page - 1)}>Sebelumnya</button><span aria-live="polite">Halaman {userPage}</span><button className={textButton} type="button" disabled={!userHasNext || userLoading} onClick={() => setUserPage(page => page + 1)}>Berikutnya</button></div></section></>}</main>
  {open && <div className={drawerLayer}><button className={backdrop} aria-label="Tutup menu" onClick={() => setOpen(false)} /><aside ref={drawerRef} className={drawer} role="dialog" aria-modal="true" aria-label="Menu admin"><div className={drawerHeader}><span className={drawerBrand}><span className={drawerBrandMark}>M</span><span>ADMIN MADEVI</span></span><button className={roundControl} aria-label="Tutup" onClick={() => setOpen(false)}><X size={20} /></button></div><nav className={adminMenu}><button className={roomPill} onClick={() => {
            setPanel("dashboard");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><LayoutDashboard size={19} /><strong className={roomPillText}>Dashboard</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button><button className={roomPill} onClick={() => {
            setPanel("users");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><Users size={19} /><strong className={roomPillText}>Pengguna</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button><button className={roomPill} onClick={() => {
            setPanel("content");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><FileText size={19} /><strong className={roomPillText}>Konten</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button><button className={roomPill} onClick={() => {
            setPanel("notifications");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><Bell size={19} /><strong className={roomPillText}>Notifikasi dan pesan</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button><button className={roomPill} onClick={() => {
            setPanel("system");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><Database size={19} /><strong className={roomPillText}>Sistem dan backup</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button><button className={roomPill} onClick={() => {
            setPanel("reports");
            setOpen(false);
            if (profile) window.location.href = "/admin";
          }}><Activity size={19} /><strong className={roomPillText}>Laporan Masalah</strong><ArrowUpRight className="text-madevi-muted" size={16} /></button></nav><button className={adminLogout} onClick={async () => {
          await authClient.signOut();
          window.location.href = "/admin";
        }}><LogOut size={17} />Keluar</button></aside></div>}</>;
}
