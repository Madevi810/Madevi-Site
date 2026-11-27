"use client";

import { useEffect, useRef, useState } from "react";
import { AdminRequestError, AdminHeading, AdminLoading, AdminPageNav, adminJson, adminRequest, localDate, useAdminData, value, values } from "./admin-data";
import { adminPanel, fieldLabel, inputControl, primaryButton, statusMessage, textButton } from "./styles";

type Operation={id:string;kind:string;status:string;artifact:string|null;bytes:string|null;requested_at:string;requested_by:string|null;target:string|null;artifact_id:string|null;seconds:number|null;details:string|null;phase:string|null;progress_at:string;routine:boolean};
type Choice={id:string;revision:string;migrations?:string[];cpus?:number;memoryMiB?:number};
type Capabilities={backup:boolean;restoreTarget:string|null;host:null|{active:{release:string;configuration:string};releases:Choice[];configurations:Choice[]}};
type Artifact={id:string;artifact:string;bytes:string;finished_at:string};
export type OperationalCheck={state:string;detail:string;at?:string};
export const operationalStatus:Record<string,string>={ready:"Siap",unconfigured:"Belum dikonfigurasi",inactive:"Opsional, tidak aktif",failed:"Gagal",stale:"Kedaluwarsa",operator_check:"Perlu pemeriksaan operator"};
const checkLabels:Record<string,string>={configuration:"Konfigurasi host",backup:"Backup",restore:"Target restore",host:"Katalog rollback",alert:"Alarm SMTP",schedule:"Jadwal host",download:"Mount unduhan"};
type System={readiness:string;jobs:Operation[];next:boolean;migrations:{version:string;checksum:string;applied_at:string}[];artifacts:Artifact[];moreArtifacts:boolean;downloadConfigured:boolean;downloadState:string;worker:null|{checked_at:string;fresh:boolean;capabilities:Capabilities;readiness:Record<string,OperationalCheck>|null};checks:{id:string;target:string;finished_at:string}[]};
const statuses:Record<string,string>={queued:"Menunggu eksekusi",running:"Sedang diproses",completed:"Selesai",failed:"Gagal"};
const labels:Record<string,string>={backup:"Buat backup",verify:"Verifikasi backup",target_check:"Periksa target restore",restore:"Restore database",release:"Ganti rilis",host_config:"Terapkan profil host"};
const phases:Record<string,string>={dumping:"Membuat dump terenkripsi",verifying:"Memeriksa artefak",checking_target:"Memeriksa target",restoring:"Menulis ke target terisolasi",restarting:"Mengganti container dan menguji",recovering:"Mengembalikan profil sebelumnya",interrupted:"Worker terhenti"};

export function AdminSystem() {
  const [page,setPage]=useState(1),[backups,setBackups]=useState(1);
  const [kind,setKind]=useState("backup"),[artifactId,setArtifactId]=useState(""),[target,setTarget]=useState("");
  const [retry,setRetry]=useState<Operation>(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const pending=useRef(false);
  const [uncertain,setUncertain]=useState<{id:string;action:Record<string,unknown>;canRetry:boolean}>();
  const {data,error,reload}=useAdminData<System>(`/api/admin/operations?page=${page}&backups=${backups}`);
  const reloadRef=useRef(reload);reloadRef.current=reload;
  const hasWork=data?.jobs.some(job=>job.status==="queued"||job.status==="running")??false;
  useEffect(()=>{
    if(!hasWork)return;
    const timer=setInterval(()=>reloadRef.current(),5000);
    return ()=>clearInterval(timer);
  },[hasWork]);
  const capabilities=data?.worker?.fresh?data.worker.capabilities:null;
  const choices=kind==="release"?capabilities?.host?.releases:kind==="host_config"?capabilities?.host?.configurations:undefined;
  const choice=choices?.find(item=>item.id===target);
  const restoreTarget=capabilities?.restoreTarget??null;
  const check=data?.checks.find(item=>item.target===restoreTarget);
  const needsArtifact=["verify","restore","release","host_config"].includes(kind);
  const selectedArtifact=data?.artifacts.find(item=>item.id===artifactId);
  const confirmation=kind==="restore"&&check&&artifactId?`PULIHKAN ${check.target} ${check.id} ${artifactId}`:choice?`TERAPKAN ${choice.id}`:"";
  const intended=kind==="release"?choice:capabilities?.host?.releases.find(item=>item.id===capabilities.host?.active.release);
  const switching=["release","host_config"].includes(kind);
  const compatible=!switching||Boolean(intended&&data&&JSON.stringify([...intended.migrations??[]].sort())===JSON.stringify(data.migrations.map(item=>item.version).sort()));
  const needsRestoreTarget=kind==="restore"||kind==="target_check";
  const unavailable=!capabilities || (kind!=="target_check"&&!capabilities.backup)
    || (needsRestoreTarget&&!restoreTarget) || (kind==="restore"&&!check)
    || (needsArtifact&&!artifactId) || (switching&&(!choice||!compatible));
  return <><AdminHeading description="Antrean host, cadangan dan profil pemulihan Madevi.">Database & Pemulihan</AdminHeading>
  {!data?<><button className={textButton} onClick={reload}>Muat ulang</button><AdminLoading error={error}/></>:<>
    <button className={textButton} onClick={reload}>Muat ulang status</button>
    <section className={adminPanel}><h2>Kesiapan operasi</h2>
      <p>Database {data.readiness==="ready"?"terhubung":data.readiness==="schema_pending"?"menunggu migrasi":"tidak terhubung"}.</p>
      <p>{data.worker? `Laporan worker ${localDate(data.worker.checked_at)}${data.worker.fresh?"":" · sudah kedaluwarsa"}.`:"Worker belum melaporkan kesiapan."}</p>
      {data.worker?.readiness?<ul>{Object.entries(data.worker.readiness).map(([name,check])=><li key={name}>
        <strong>{checkLabels[name]??name}</strong> · {data.worker?.fresh?operationalStatus[check.state]:operationalStatus.stale}. {check.detail}
      </li>)}</ul>:<p>Kesiapan backup, alarm, dan jadwal belum dapat dinilai sebelum ada laporan dari host.</p>}
      <p>{restoreTarget?`Target terpisah ${restoreTarget}.`:"Target restore belum tersedia."}</p>
      <p>{capabilities?.host?`Rilis aktif ${capabilities.host.active.release} · profil host ${capabilities.host.active.configuration}.`:"Rollback menunggu katalog dan profil awal Compose pada host."}</p>
    </section>
    <section className={adminPanel}><h2>Ajukan pekerjaan</h2>
      <form method="post" className="grid gap-3" onSubmit={async event=>{
        event.preventDefault();if(pending.current||unavailable&&!uncertain||uncertain&&!uncertain.canRetry)return;
        const form=event.currentTarget,data=values(form);
        const action={kind,artifactId:needsArtifact?artifactId:undefined,target:needsRestoreTarget?restoreTarget:choice?.id,
          checkId:kind==="restore"?check?.id:undefined,revision:choice?.revision,confirmation:confirmation?value(data,"confirmation"):undefined,retryOf:retry?.id};
        const requestId=uncertain?.id??crypto.randomUUID();
        const original=uncertain?.action??action;
        pending.current=true;setBusy(true);setMessage("");
        try {
          await adminRequest("/api/admin/operations",adminJson("POST",{...original,id:requestId,password:value(data,"password")}));
          setUncertain(undefined);setRetry(undefined);setPage(1);reload();setMessage("Permintaan tercatat. Pantau antrean untuk hasil.");
        } catch(error) {if(error instanceof AdminRequestError&&(error.uncertain||Boolean(uncertain)&&error.status===429))setUncertain({id:requestId,action:original,canRetry:false});else setUncertain(undefined);setMessage((error as Error).message);}
        finally {
          const password=form.elements.namedItem("password");
          if(password instanceof HTMLInputElement)password.value="";
          pending.current=false;setBusy(false);
        }
      }}>
        <label className={fieldLabel}>Jenis operasi<select className={inputControl} value={kind} disabled={busy||Boolean(uncertain)} onChange={e=>{setKind(e.target.value);setTarget("");setRetry(undefined);}}>
          {Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select></label>
        {needsArtifact&&<label className={fieldLabel}>Backup sumber<select className={inputControl} value={artifactId} disabled={busy||Boolean(uncertain)} onChange={e=>{setArtifactId(e.target.value);setRetry(undefined);}} required>
          <option value="">Pilih dari daftar cadangan</option>
          {artifactId&&!selectedArtifact&&<option value={artifactId}>Artefak dipilih dari riwayat</option>}
          {data.artifacts.map(item=><option key={item.id} value={item.id}>{item.artifact}</option>)}
        </select></label>}
        {choices&&<label className={fieldLabel}>Profil tujuan<select className={inputControl} value={target} disabled={busy||Boolean(uncertain)} required={!uncertain} onChange={e=>{setTarget(e.target.value);setRetry(undefined);}}>
          <option value="">Pilih profil dari katalog host</option>{choices.map(item=><option key={item.id} value={item.id}>{item.id}</option>)}
        </select></label>}
        {kind==="restore"&&<p>Restore memakai backup terpilih dan menulis hanya ke target baru {restoreTarget??"yang disiapkan operator"}. {check?`Target lulus pemeriksaan pada ${localDate(check.finished_at)}. Worker mengulang pemeriksaan sebelum menulis. Pekerjaan lama yang belum selesai ditutup pada target.`:"Jalankan Periksa target restore terlebih dahulu."}</p>}
        {kind==="release"&&<p>Container aplikasi akan dibuat ulang. PostgreSQL tetap pada skema aktif. {choice&&`Migrasi yang didukung ${choice.migrations?.join(", ")}.`}</p>}
        {switching&&choice&&<p role="status">{compatible?"Daftar migrasi cocok. Worker memverifikasi backup baru sebelum restart.":"Rilis tujuan tidak kompatibel dengan skema aktif."}</p>}
        {kind==="host_config"&&<p>Container akan dibuat ulang dengan profil CPU dan memori yang dipilih. {choice&&`${choice.cpus} CPU · ${choice.memoryMiB} MiB.`}</p>}
        {confirmation&&<label className={fieldLabel}>Ketik <code className="break-all">{confirmation}</code><input key={confirmation} className={inputControl} name="confirmation" autoComplete="off" required={!uncertain}/></label>}
        {retry&&<p>Percobaan ulang pekerjaan {retry.id}.</p>}
        <label className={fieldLabel}>Kata sandi admin<input className={inputControl} type="password" name="password" autoComplete="current-password" maxLength={128} required/></label>
        <button className={primaryButton} disabled={busy||(!uncertain&&unavailable)||Boolean(uncertain&&!uncertain.canRetry)}>{busy?"Mencatat…":uncertain?.canRetry?"Ajukan kembali permintaan yang sama":"Ajukan operasi"}</button>
        {message&&<p role="status" className={statusMessage}>{message}</p>}
      </form>
      {uncertain&&<button className={textButton} disabled={busy} onClick={async()=>{
        if(pending.current)return;
        pending.current=true;setBusy(true);
        try {
          const saved=await adminRequest<{status:string}>(`/api/admin/operations?request=${uncertain.id}`);
          setMessage(`Permintaan tercatat. Status ${statuses[saved.status]}.`);
          setUncertain(undefined);setRetry(undefined);setPage(1);reload();
        } catch(error){
          if(error instanceof AdminRequestError&&error.status===404) {
            setMessage("Permintaan belum ditemukan. Isi ulang kata sandi untuk mengirim kembali permintaan yang sama.");
            setUncertain({...uncertain,canRetry:true});
          } else setMessage((error as Error).message);
        } finally {pending.current=false;setBusy(false);}
      }}>Periksa permintaan yang terputus</button>}
    </section>
    <section className={adminPanel}><h2>Artefak backup</h2>
      {data.artifacts.length?<ul>{data.artifacts.map(item=><li key={item.id} className="border-b border-madevi-line py-3">
        <p className="break-all">{item.artifact} · {item.bytes} byte · {localDate(item.finished_at)}</p>
        {data.downloadConfigured&&<a href={`/api/admin/operations/artifacts/${item.id}`}>Unduh terenkripsi</a>}
        <button className={textButton} onClick={()=>{setKind("verify");setArtifactId(item.id);setRetry(undefined);}}>Pilih untuk verifikasi</button>
        {restoreTarget&&<button className={textButton} onClick={()=>{setKind("restore");setArtifactId(item.id);setRetry(undefined);}}>Pilih untuk restore</button>}
      </li>)}</ul>:<p>Belum ada cadangan selesai.</p>}
      {!data.downloadConfigured&&<p>{data.downloadState==="failed"?"Mount unduhan gagal diperiksa. Periksa direktori privat dan izin container.":"Unduhan belum diaktifkan. Gunakan mount direktori cadangan baca-saja."}</p>}
      <AdminPageNav page={backups} next={data.moreArtifacts} move={setBackups}/>
    </section>
    <section className={adminPanel}><h2>Antrean dan riwayat pekerjaan</h2>
      {data.jobs.length?<ul>{data.jobs.map(item=><li key={item.id} className="border-b border-madevi-line py-3">
        <strong>{labels[item.kind]} · {statuses[item.status]}</strong>
        <p>{localDate(item.requested_at)} · {item.requested_by?`Admin ${item.requested_by}`:item.routine?"Jadwal host":"Terminal host"}{item.seconds!==null&&` · ${item.seconds} detik`}</p>
        {item.target&&<p>Tujuan {item.target}</p>}
        {item.artifact&&<p className="break-all">{item.artifact}</p>}
        <p>Pembaruan {localDate(item.progress_at)}</p>
        {item.phase&&phases[item.phase]&&<p>{phases[item.phase]}</p>}{item.details&&<p>{item.details}</p>}
        {item.status==="failed"&&item.requested_by&&<button className={textButton} onClick={()=>{setRetry(item);setKind(item.kind);setTarget(item.target??"");setArtifactId(item.artifact_id??"");}}>Siapkan percobaan ulang</button>}
      </li>)}</ul>:<p>Belum ada pekerjaan yang tercatat.</p>}
      <AdminPageNav page={page} next={data.next} move={setPage}/>
    </section>
    <section className={adminPanel}><h2>Riwayat migrasi</h2><ul>{data.migrations.map(item=><li key={item.version}>
      <strong>{item.version}</strong> · {localDate(item.applied_at)}<br/><code className="break-all text-xs">{item.checksum}</code>
    </li>)}</ul></section>
  </>}</>;
}
