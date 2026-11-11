"use client";

import { useEffect, useState } from "react";
import { rooms } from "@/lib/rooms";
import { eyebrow, adminTitle, adminPanel, userRow, fieldLabel, inputControl, textAreaControl, formLayout, statusMessage, primaryButton, outlineButton, textButton } from "./styles";
type Item = {
  id: string;
  space: string;
  type: string;
  slug: string;
  title: string;
  workflow_status: string;
  latest_revision: number;
  deleted_at: string | null;
  body: {
    blocks?: unknown;
  };
  metadata: Record<string, unknown>;
};
type ResponseData = {
  items?: Item[];
  total?: number;
  error?: {
    message?: string;
  };
};
export function AdminContent({}: {}) {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [space, setSpace] = useState("explore");
  const [type, setType] = useState("article");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/content?limit=25&page=${page}`, {cache:"no-store", signal});
      const data: ResponseData = await r.json();
      if (!r.ok) throw Error(data.error?.message || "Data tidak tersedia.");
      if (!signal?.aborted) { setItems(data.items || []);setTotal(data.total || 0); }
    } catch { if (!signal?.aborted) { setItems([]);setTotal(0);setMessage("Daftar konten belum tersedia."); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [page]);
  function reset() {
    setEdit(null);
    setSpace("explore");
    setType("article");
    setSlug("");
    setTitle("");
    setBody("");
  }
  function start(row: Item) {
    if (!row.body || Object.keys(row.body).some(k => k !== "blocks") || !Array.isArray(row.body.blocks) || !row.body.blocks.every(x => typeof x === "string")) {
      setMessage("Format materi ini belum dapat diubah melalui formulir teks.");
      return;
    }
    setEdit(row);
    setSpace(row.space);
    setType(row.type);
    setSlug(row.slug);
    setTitle(row.title);
    setBody(row.body.blocks.join("\n\n"));
    setMessage("");
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    const blocks = body.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
    const data = edit ? {
      title,
      body: {
        blocks
      },
      metadata: edit.metadata,
      expectedRevision: edit.latest_revision
    } : {
      space,
      type,
      slug,
      title,
      body: {
        blocks
      },
      metadata: {}
    };
    try {
      const response = await fetch(edit ? `/api/admin/content/${edit.id}` : "/api/admin/content", {
        method: edit ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || "Konten tidak tersimpan.");
      reset();
      setMessage("Draf tersimpan.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Konten tidak tersimpan.");
    } finally {
      setPending(false);
    }
  }
  async function trash(row: Item, action: "trash" | "restore") {
    if (action === "trash" && !window.confirm("Pindahkan konten yang diarsipkan ke tempat sampah?")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/content/${row.id}/trash`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action,
          expectedRevision: row.latest_revision
        })
      });
      if (!response.ok) throw Error("Konten belum dapat diproses.");
      setMessage(action === "trash" ? "Konten dipindahkan ke tempat sampah." : "Konten dipulihkan ke arsip.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setPending(false);
    }
  }
  async function transition(row: Item, action: string) {
    if (action === "archive" && !window.confirm("Arsipkan konten ini?")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/content/${row.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action,
          expectedRevision: row.latest_revision
        })
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || "Status tidak berubah.");
      setMessage("Status diperbarui.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Status tidak berubah.");
    } finally {
      setPending(false);
    }
  }
  return <><p className={eyebrow}>ADMIN / KONTEN</p><div className={adminTitle}><div><h1>Konten</h1><p>Kelola draf dan penerbitan Madevi.</p></div></div>{message && <p className={statusMessage} role="status">{message}</p>}<section className={adminPanel}><h2>{edit ? "Ubah draf" : "Buat draf"}</h2><form className={formLayout} onSubmit={save}><label className={fieldLabel}>Ruang<select className="h-madevi-46 w-full rounded-madevi-12 border border-madevi-line bg-madevi-surface px-madevi-14 text-madevi-text" value={space} onChange={e => setSpace(e.target.value)} disabled={Boolean(edit)}>{rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></label><label className={fieldLabel}>Jenis<input className={inputControl} value={type} onChange={e => setType(e.target.value)} pattern="[a-z][a-z0-9_-]{1,49}" disabled={Boolean(edit)} required /></label><label className={fieldLabel}>Slug<input className={inputControl} value={slug} onChange={e => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={Boolean(edit)} required /></label><label className={fieldLabel}>Judul<input className={inputControl} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><label className={fieldLabel}>Materi teks<textarea className={textAreaControl} rows={6} value={body} onChange={e => setBody(e.target.value)} /></label><button className={primaryButton} disabled={pending}>{edit ? "Simpan revisi" : "Simpan draf"}</button>{edit && <button type="button" className={textButton} onClick={reset}>Batal</button>}</form></section><section className={adminPanel}><h2>Daftar konten</h2>{items.length ? items.map(row => <div className={userRow} key={row.id}><div><strong>{row.title}</strong><p>{row.space} · {row.deleted_at ? "tempat sampah" : row.workflow_status} · revisi {row.latest_revision}</p></div><div>{row.deleted_at ? <button className={textButton} disabled={pending} onClick={() => void trash(row, "restore")}>Pulihkan ke arsip</button> : <>{["draft", "published"].includes(row.workflow_status) && <button className={outlineButton} disabled={pending} onClick={() => start(row)}>Ubah</button>}{row.workflow_status === "draft" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "submit")}>Ajukan</button>}{row.workflow_status === "in_review" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "approve")}>Setujui</button>}{row.workflow_status === "approved" && <button className={textButton} disabled={pending} onClick={() => void transition(row, "publish")}>Terbitkan</button>}{row.workflow_status !== "archived" ? <button className={textButton} disabled={pending} onClick={() => void transition(row, "archive")}>Arsipkan</button> : <><button className={textButton} disabled={pending} onClick={() => void transition(row, "reopen")}>Buka lagi</button><button className={textButton} disabled={pending} onClick={() => void trash(row, "trash")}>Hapus</button></>}</>}</div></div>) : <p className="text-madevi-muted">{loading ? "Memuat konten…" : "Belum ada konten."}</p>}<div className="mt-madevi-12 flex items-center gap-madevi-12" aria-label="Halaman konten"><button className={textButton} type="button" disabled={page === 1 || loading || pending} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">Halaman {page}</span><button className={textButton} type="button" disabled={page * 25 >= total || loading || pending} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></section></>;
}
