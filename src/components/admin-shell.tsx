"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, ChevronDown, ChevronRight, Database, FileText, Globe, Image, LayoutDashboard, LogOut, Menu, MessagesSquare, Search, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { rooms } from "@/lib/rooms";
import { useFocusTrap } from "./ui";
import { AdminContent } from "./admin-content";
import { AdminMessages } from "./admin-messages";
import { AdminAccounts, AdminReports, AdminRules, AdminSummary } from "./admin-records";
import { AdminSite, AdminMedia } from "./admin-site-media";
import { AdminSystem } from "./admin-system";
import { NotificationCenter } from "./notification-center";
import { AdminHeading, useAdminData } from "./admin-data";
import { topBar, brand, brandMark, headerRight, roundControl, popup, popupTitle, popupRow, popupButton, drawerLayer, backdrop, drawer, drawerHeader, drawerBrand, drawerBrandMark, adminMain, adminPanel, avatar, adminMenu, adminLogout, roomPill, roomPillText, fieldLabel, inputControl, statusMessage, textButton, primaryButton } from "./styles";

const groups=[
  {label:"Ringkasan",items:[["dashboard","Dashboard",LayoutDashboard],["statistics","Statistik & Monitoring",Activity]]},
  {label:"Isi website",items:[["content","Ruang Madevi",FileText],["pages","Halaman & Navigasi",Globe],["media","Media & Berkas",Image]]},
  {label:"Akun dan komunikasi",items:[["users","Pengguna",Users],["notifications","Notifikasi & Pesan",Bell],["rules","Asisten & Respons Otomatis",MessagesSquare],["reports","Laporan & Dukungan",Activity]]},
  {label:"Operasional",items:[["system","Database & Pemulihan",Database],["settings","Pengaturan Website",Settings],["security","Keamanan & Audit",ShieldCheck]]},
] as const;
const menuItems=groups.flatMap(group=>[...group.items]);
const focusStyle="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madevi-accent";
const activeStyle="aria-[current=page]:border-madevi-accent aria-[current=page]:bg-madevi-soft aria-[current=page]:ring-1 aria-[current=page]:ring-madevi-accent";

export function AdminShell({name,profile=false,email="",username=""}:{name:string;profile?:boolean;email?:string;username?:string}) {
  const [location,setLocation]=useState({panel:"dashboard",room:""});
  const [open,setOpen]=useState(false),[menuQuery,setMenuQuery]=useState(""),[focusSearch,setFocusSearch]=useState(false);
  const [roomsOpen,setRoomsOpen]=useState(false);
  const [settings,setSettings]=useState(false),[notice,setNotice]=useState(false);
  const [profileName,setProfileName]=useState(name),[message,setMessage]=useState("");
  const drawerRef=useRef<HTMLElement>(null);
  const headingRef=useRef<HTMLElement>(null);
  const reports=useAdminData<{reports:unknown[]}>(notice?"/api/admin/reports?status=new&limit=1":"");
  useFocusTrap(open,drawerRef,()=>setOpen(false));
  useEffect(()=>{if(open&&focusSearch)drawerRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();},[open,focusSearch]);
  useEffect(()=>{
    function read() {
      const query=new URLSearchParams(window.location.search);
      const panel=query.get("panel"), room=query.get("room");
      setRoomsOpen(panel==="content");
      setLocation({panel:menuItems.some(item=>item[0]===panel)?panel!:"dashboard",room:rooms.some(item=>item.slug===room)?room!:""});
    }
    read();window.addEventListener("popstate",read);
    document.documentElement.dataset.theme=localStorage.getItem("madevi-theme")==="dark"?"dark":"light";
    function dismiss(event:KeyboardEvent) {if(event.key==="Escape"){setSettings(false);setNotice(false);}}
    function outside(event:PointerEvent) {
      if(event.target instanceof Element&&!event.target.closest("[data-admin-popup-panel], [data-admin-popup-toggle]")){setSettings(false);setNotice(false);}
    }
    document.addEventListener("keydown",dismiss);document.addEventListener("pointerdown",outside);
    return ()=>{window.removeEventListener("popstate",read);document.removeEventListener("keydown",dismiss);document.removeEventListener("pointerdown",outside);};
  },[]);
  function target(panel:string,room?:string) {
    const query=new URLSearchParams();
    if(panel!=="dashboard")query.set("panel",panel);
    if(room)query.set("room",room);
    return `/admin${query.size?`?${query}`:""}`;
  }
  function navigate(panel:string,room?:string) {
    setOpen(false);setNotice(false);setSettings(false);
    const href=target(panel,room);
    if(profile){window.location.assign(href);return;}
    if(href!==window.location.pathname+window.location.search)window.history.pushState(null,"",href);
    setLocation({panel,room:room??""});
    if(panel==="content")setRoomsOpen(true);
    requestAnimationFrame(()=>{headingRef.current?.focus({preventScroll:true});window.scrollTo({top:0});});
  }
  const query=menuQuery.trim().toLowerCase();
  const showRooms=roomsOpen||Boolean(query);
  const matches=(label:string)=>label.toLowerCase().includes(query);
  const hasResults=menuItems.some(item=>matches(item[1]))||rooms.some(room=>matches(room.name));
  const nav=<>
    <label className={fieldLabel}>Cari menu<input className={inputControl} type="search" value={menuQuery} onChange={e=>setMenuQuery(e.target.value)}/></label>
    <nav aria-label="Panel admin">
      {groups.map(group=>{
        const visible=group.items.filter(([id,label])=>matches(label)||(id==="content"&&rooms.some(room=>matches(room.name))));
        if(!visible.length)return null;
        return <section className="my-4" key={group.label}><h2 className="text-xs font-semibold text-madevi-muted">{group.label}</h2>
          {visible.map(([id,label,Icon])=>{
            const roomGroup=id==="content";
            const current=!profile&&location.panel===id&&!location.room;
            return <div key={id}>
              <div className="flex items-start gap-1">
                <button className={`${roomPill} ${focusStyle} ${current?activeStyle:""}`} aria-current={current?"page":undefined} onClick={()=>navigate(id)}>
                  <Icon size={16} aria-hidden="true"/><strong className={roomPillText}>{label}</strong>
                </button>
                {roomGroup&&!query&&<button type="button" className={`grid h-10 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-madevi-line bg-madevi-surface ${focusStyle}`}
                  aria-label={roomsOpen?"Tutup submenu ruang":"Buka submenu ruang"} aria-expanded={roomsOpen} onClick={()=>setRoomsOpen(!roomsOpen)}>
                  {roomsOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
                </button>}
              </div>
              {roomGroup&&showRooms&&<ul className="mb-3 mt-0 list-none space-y-1 pl-4">
                {rooms.filter(room=>matches(room.name)||matches(label)).map(room=>{
                  const active=!profile&&location.panel==="content"&&location.room===room.slug;
                  return <li key={room.slug}><button type="button"
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm ${focusStyle} ${active?activeStyle:"border-transparent bg-transparent hover:bg-madevi-soft"}`}
                    aria-current={active?"page":undefined} onClick={()=>navigate("content",room.slug)}>{room.name}</button></li>;
                })}
              </ul>}
            </div>;
          })}
        </section>;
      })}
      {!hasResults&&<p role="status">Tidak ada menu yang cocok.</p>}
    </nav>
  </>;
  const {panel,room}=location;
  const headerControl=`${roundControl} shrink-0 compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`;
  const label=menuItems.find(item=>item[0]===panel)?.[1]??"Dashboard";
  const theme=(value:string)=>{document.documentElement.dataset.theme=value;localStorage.setItem("madevi-theme",value);setSettings(false);};
  return <>
  <header className={`${topBar.replace("gap-madevi-20","").replace("compact:px-madevi-16","")} gap-2 compact:px-3 narrow:px-2`}>
    <Link className={`${brand.replace("gap-madevi-11","").replace("compact:text-madevi-brand-mobile","")} gap-2 compact:text-xs narrow:gap-1 narrow:text-[10px]`} href="/admin"><span className={`${brandMark.replace("compact:h-madevi-38-icon","").replace("compact:w-madevi-38-icon","")} compact:h-madevi-32 compact:w-madevi-32 narrow:h-madevi-28-icon narrow:w-madevi-28-icon`}>M</span><span>ADMIN MADEVI</span></Link>
    <div className={`${headerRight.replace("compact:gap-madevi-6","").replace("gap-madevi-10","")} shrink-0 gap-1`}>
      <button className={headerControl} type="button" aria-label="Cari di panel" onClick={()=>{setMenuQuery("");setFocusSearch(true);setOpen(true);}}><Search size={17}/></button>
      <button className={headerControl} type="button" data-admin-popup-toggle aria-label="Notifikasi" aria-expanded={notice} onClick={()=>{setNotice(!notice);setSettings(false);}}><Bell size={17}/></button>
      <button className={headerControl} type="button" data-admin-popup-toggle aria-label="Pengaturan" aria-expanded={settings} onClick={()=>{setSettings(!settings);setNotice(false);}}><Settings size={17}/></button>
      <Link className={headerControl} href="/admin/profile" aria-label="Profil admin"><UserRound size={17}/></Link>
      <button className={headerControl} type="button" aria-label="Menu admin" onClick={()=>{setMenuQuery("");setFocusSearch(false);setOpen(true);}}><Menu size={19}/></button>
    </div>
    {notice&&<div data-admin-popup-panel className={popup}><NotificationCenter english={false} onClose={()=>setNotice(false)}/>
      <p role="status">{reports.error?"Status laporan belum tersedia.":reports.data?reports.data.reports.length?"Ada laporan baru.":"Tidak ada laporan baru.":"Memeriksa laporan…"}</p>
      <button className={textButton} onClick={()=>navigate("reports")}>Buka laporan</button>
    </div>}
    {settings&&<div data-admin-popup-panel className={popup}><strong className={popupTitle}>Tema</strong><div className={popupRow}>
      <button className={popupButton} onClick={()=>theme("light")}>Terang</button><button className={popupButton} onClick={()=>theme("dark")}>Gelap</button>
    </div><button className={textButton} onClick={()=>navigate("settings")}>Pengaturan Website</button></div>}
  </header>
  <div className="mx-auto max-w-[1440px] xl:grid xl:grid-cols-[270px_minmax(0,1fr)]">
  <aside className={`hidden border-r border-madevi-line bg-madevi-surface px-4 py-6 ${open?"":"xl:block"}`} aria-label="Navigasi admin">{nav}</aside>
  <main className={`${adminMain} w-full min-w-0 [overflow-wrap:anywhere] xl:col-start-2`} ref={headingRef} tabIndex={-1}>
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-madevi-muted" aria-label="Jejak navigasi">
      <Link href="/admin">Admin</Link><span aria-hidden="true">/</span>
      {room&&!profile?<><button className={textButton} onClick={()=>navigate("content")}>{label}</button><span aria-hidden="true">/</span><span aria-current="page">{rooms.find(item=>item.slug===room)?.name}</span></>:<span aria-current="page">{profile?"Profil":label}</span>}
    </nav>
    {profile?<><AdminHeading>Profil Admin</AdminHeading><section className={adminPanel}><div className={avatar}><UserRound size={28}/></div>
      <form className="grid gap-3" onSubmit={async e=>{
        e.preventDefault();
        try{const result=await authClient.updateUser({name:profileName});setMessage(result.error?"Gagal menyimpan profil.":"Profil tersimpan.");}
        catch{setMessage("Gagal menyimpan profil.");}
      }}><label className={fieldLabel}>Nama lengkap<input className={inputControl} value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={100} required/></label>
        <p>{username} · {email}</p><button className={primaryButton}>Simpan perubahan</button>{message&&<p role="status" className={statusMessage}>{message}</p>}
      </form></section></>:<>
      {(panel==="dashboard"||panel==="statistics"||panel==="security")&&<AdminSummary mode={panel} navigate={navigate}/>}
      {panel==="content"&&<AdminContent key={room} room={room||undefined}/>}
      {panel==="users"&&<AdminAccounts/>}
      {panel==="reports"&&<AdminReports/>}
      {panel==="notifications"&&<AdminMessages/>}
      {panel==="rules"&&<AdminRules/>}
      {panel==="system"&&<AdminSystem/>}
      {(panel==="settings"||panel==="pages")&&<AdminSite key={panel} mode={panel}/>}
      {panel==="media"&&<AdminMedia/>}
    </>}
  </main>
  </div>
  {open&&<div className={drawerLayer}><button className={backdrop} aria-label="Tutup menu" onClick={()=>setOpen(false)}/>
    <aside ref={drawerRef} className={drawer} role="dialog" aria-modal="true" aria-label="Menu admin">
      <div className={drawerHeader}><span className={drawerBrand}><span className={drawerBrandMark}>M</span><span>ADMIN MADEVI</span></span>
      <button className={roundControl} aria-label="Tutup" onClick={()=>setOpen(false)}><X size={19}/></button></div>
      <div className={adminMenu}>{nav}</div>
      <button className={adminLogout} onClick={async()=>{try{const result=await authClient.signOut();if(result.error)throw Error();window.location.assign("/admin");}catch{setMessage("Keluar belum berhasil. Coba lagi.");}}}><LogOut size={16}/>Keluar</button>
      {message&&!profile&&<p role="status" className={statusMessage}>{message}</p>}
    </aside>
  </div>}
  </>;
}
