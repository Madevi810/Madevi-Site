"use client";

import { AdminLoading, localDate, useAdminData } from "./admin-data";
import { operationalStatus, type OperationalCheck } from "./admin-system";
import { adminPanel, textButton } from "./styles";

type Probe={ok:boolean;status:number;ms:number}|null;
type Monitoring={
  since:string;checkedAt:string;labels:Record<string,string>;database:string;
  requests:{route:string;count:string;errors:string;client:string;average:number;maximum:number;at:string}[];
  host:null|{checked_at:string;fresh:boolean;metrics:{live:Probe;ready:Probe;disk:null|{total:string;available:string};memory:{total:number;free:number};load:number;cores:number;checks?:Record<string,OperationalCheck>}};
  incidents:{source:string;opened_at:string;resolved_at:string|null;detail:string}[];
  operations:{kind:string;queued:number;running:number;failed:number;completed:number;average:number|null}[];
  messages:{due:number;scheduled:number;failed:number};
  dispatch:{checked_at:string;delivered:number;failed:number;fresh:boolean}|null;
};
const units=new Intl.NumberFormat("id-ID",{maximumFractionDigits:1});
const bytes=(value:string|number)=>`${units.format(Number(value)/1024/1024)} MiB`;
const formatProbe=(value:Probe)=>value?`HTTP ${value.status} · ${value.ms} ms`:"Tidak terjangkau atau gagal diukur";
const jobLabels:Record<string,string>={backup:"Backup",restore:"Restore",target_check:"Periksa target",verify:"Verifikasi",release:"Rilis",host_config:"Profil host"};

export function OperationsMonitoring() {
  const {data,error,reload}=useAdminData<Monitoring>("/api/admin/monitoring");
  return <section className={adminPanel}><h2>Pengukuran internal</h2>
    <button className={textButton} onClick={reload}>Muat ulang pengukuran</button>
    {!data?<AdminLoading error={error}/>:<>
      <p>Dibaca pada {localDate(data.checkedAt)}. PostgreSQL {data.database==="ready"?"siap":data.database==="schema_pending"?"menunggu skema":"tidak dapat dihubungi"}.</p>
      <h3>Request pada route terukur</h3>
      <p>Sumbernya respons akhir handler Madevi sejak {localDate(data.since)} sampai {localDate(data.checkedAt)}. Durasi selesai saat header siap. Trafik proxy, byte unduhan, dan route lain berada di luar cakupan.</p>
      {Object.entries(data.labels).map(([key,label])=>{
        const row=data.requests.find(item=>item.route===key);
        return <div className="border-b border-madevi-line py-2" key={key}><strong>{label}</strong>
          <p>{row?`${row.count} request · ${row.errors} error server · ${row.client} respons 4xx · rata-rata ${row.average} ms · maks. ${row.maximum} ms`:"Belum ada sampel tercatat."}</p>
          {row&&<p>Sampel terakhir {localDate(row.at)}</p>}
        </div>;
      })}
      <h3>Probe dan kapasitas host</h3>
      <p>Sumbernya worker host. Satu sampel per putaran sebelum pekerjaan dijalankan. Disk mengukur filesystem direktori backup.</p>
      {data.host?<><p>Pembaruan {localDate(data.host.checked_at)}{data.host.fresh?".":" · pengukuran sudah kedaluwarsa."}</p>
        <ul><li>Live {formatProbe(data.host.metrics.live)}</li><li>Ready {formatProbe(data.host.metrics.ready)}</li>
        <li>Memori tersedia {bytes(data.host.metrics.memory.free)} dari {bytes(data.host.metrics.memory.total)}</li>
        <li>Beban 1 menit {data.host.metrics.load} · {data.host.metrics.cores} CPU tersedia untuk worker</li>
        <li>Disk backup {data.host.metrics.disk?`${bytes(data.host.metrics.disk.available)} tersedia dari ${bytes(data.host.metrics.disk.total)}`:data.host.metrics.checks?.backup?.state==="unconfigured"?"Belum dikonfigurasi":"Gagal diukur"}</li></ul>
        {data.host.metrics.checks?.alert&&<p>Alarm · {data.host.fresh?operationalStatus[data.host.metrics.checks.alert.state]:"Pengukuran kedaluwarsa"}. {data.host.metrics.checks.alert.detail}</p>}
      </>:<p>Worker host belum mengirim pengukuran.</p>}
      <h3>Antrean dan durasi</h3>
      <p>Sumber tabel operasi dan pesan. Status antrean berlaku saat dibaca. Jumlah hasil dan rata-rata durasi operasi dihitung sejak {localDate(data.since)}.</p>
      <p>Pesan {data.messages.due} jatuh tempo · {data.messages.scheduled} terjadwal · {data.messages.failed} berstatus gagal.</p>
      <p>{data.dispatch?`Putaran worker pesan ${localDate(data.dispatch.checked_at)} · ${data.dispatch.delivered} berhasil · ${data.dispatch.failed} gagal${data.dispatch.fresh?"":" · kedaluwarsa"}.`:"Worker pesan belum mengirim hasil."}</p>
      {data.operations.length?<ul>{data.operations.map(row=><li key={row.kind}>{jobLabels[row.kind]} · {row.queued} antre · {row.running} berjalan · {row.completed} berhasil · {row.failed} gagal · {row.average===null?"durasi belum tersedia":`rata-rata ${row.average} detik`}</li>)}</ul>:<p>Belum ada pekerjaan operasi.</p>}
      <h3>Gangguan dan pemulihan</h3>
      <p>20 kejadian terakhir dari probe dan worker operasi. Riwayat insiden dipertahankan.</p>
      {data.incidents.length?<ul>{data.incidents.map(row=><li className="border-b border-madevi-line py-2" key={row.source+row.opened_at}>
        <strong>{row.source}</strong> · {row.detail}<p>Mulai {localDate(row.opened_at)} · {row.resolved_at?`Pulih ${localDate(row.resolved_at)}`:"Masih terbuka"}</p>
      </li>)}</ul>:<p>Belum ada kejadian tercatat.</p>}
    </>}
  </section>;
}
