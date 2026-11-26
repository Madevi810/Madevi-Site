"use client";

import { useState } from "react";
import { AdminHeading, AdminLoading, AdminPageNav, localDate, useAdminData } from "./admin-data";
import { adminPanel, textButton } from "./styles";

type Operation={id:string;kind:string;status:string;artifact:string|null;bytes:string|null;started_at:string;finished_at:string|null;seconds:number|null;details:string|null};
type System={readiness:string;backupConfigured:boolean;jobs:Operation[]|null;next:boolean;migrations:{version:string;checksum:string;applied_at:string}[]|null};
const status:Record<string,string>={running:"Berjalan",completed:"Selesai",failed:"Gagal"};

export function AdminSystem() {
  const [page,setPage]=useState(1);
  const {data,error,reload}=useAdminData<System>(`/api/admin/operations?page=${page}`);
  return <><AdminHeading description="Kesiapan PostgreSQL, riwayat migrasi, dan pekerjaan host yang tercatat.">Database & Pemulihan</AdminHeading>
  {!data?<AdminLoading error={error}/>:<>
    <button className={textButton} onClick={reload}>Muat ulang status</button>
    <section className={adminPanel}><h2>Database</h2>
      <p><strong>{data.readiness==="ready"?"Terhubung":data.readiness==="schema_pending"?"Migrasi belum lengkap":"Tidak terhubung"}</strong></p>
      <h3>Riwayat migrasi</h3>
      {data.migrations===null?<p role="alert">Riwayat migrasi belum dapat dibaca.</p>:data.migrations.length?<ul>{data.migrations.map(item=><li key={item.version}>
        <strong>{item.version}</strong> · {localDate(item.applied_at)}<br/><code className="break-all text-xs">{item.checksum}</code>
      </li>)}</ul>:<p>Belum ada migrasi yang tercatat.</p>}
    </section>
    <section className={adminPanel}><h2>Backup terenkripsi dan restore terisolasi</h2>
      <p>{data.backupConfigured?"Variabel backup tersedia bagi proses aplikasi. Cocokkan izin, kunci, dan direktori pada host.":"Konfigurasi backup belum tersedia bagi proses aplikasi. Pekerjaan membutuhkan direktori privat, kunci, dan PostgreSQL client pada host."}</p>
      <p>Jalankan perintah backup, verifikasi integritas, dan restore dari terminal host yang berwenang. Restore meminta konfirmasi alamat database kosong yang terpisah.</p>
      {data.jobs===null?<p role="alert">Riwayat pekerjaan belum dapat dibaca.</p>:data.jobs.length?<ul>{data.jobs.map(item=><li className="border-b border-madevi-line py-3" key={item.id}>
        <strong>{item.kind==="backup"?"Backup":"Restore"} · {status[item.status]}</strong><p>{localDate(item.started_at)} · {item.seconds===null?"Durasi belum tersedia":`${item.seconds} detik`} · {item.bytes===null?"Ukuran belum tersedia":`${item.bytes} byte`}</p>
        <code>{item.artifact}</code>{item.details&&<p>{item.details}</p>}
      </li>)}</ul>:<p>Belum ada pekerjaan yang tercatat.</p>}
      <AdminPageNav page={page} next={data.next} move={setPage}/>
    </section>
    <section className={adminPanel}><h2>Jenis pemulihan</h2><ul>
      <li>Revisi konten. Buka Ruang Madevi, lihat riwayat, lalu pulihkan sebagai draf.</li>
      <li>Konfigurasi. Pulihkan nilai environment melalui host lalu periksa kesiapan.</li>
      <li>Rilis. Gunakan artefak aplikasi versi sebelumnya setelah memeriksa kompatibilitas skema.</li>
      <li>Database. Pulihkan cadangan tervalidasi ke target kosong pada host.</li>
      <li>Media. Gambar tersimpan di PostgreSQL dan ikut dalam pemulihan database.</li>
    </ul></section>
  </>}</>;
}
