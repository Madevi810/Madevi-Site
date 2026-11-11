"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Pencil, Trash2, UserRound } from "lucide-react";

type Props = {
  english: boolean;
  image: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  onImageError?: () => void;
};

/** The menu only coordinates the picker; validation and persistence belong to its caller. */
export function PhotoEditor({ english, image, onFile, onRemove, onImageError }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const t = (id: string, en: string) => english ? en : id;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return <div ref={root} className="relative mx-auto mb-madevi-12 h-madevi-92 w-madevi-92" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <div className="grid h-madevi-92 w-madevi-92 place-items-center overflow-hidden rounded-full bg-madevi-soft text-madevi-muted [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
      {image ? <img src={image} alt="" onError={onImageError} /> : <UserRound size={38} />}
    </div>
    <button ref={trigger} type="button" className="absolute right-0 bottom-0 grid h-madevi-30 w-madevi-30 place-items-center rounded-full border-2 border-solid border-madevi-surface bg-madevi-text text-madevi-surface" aria-label={t("Opsi foto profil", "Profile photo options")} aria-expanded={open} onClick={() => setOpen(value => !value)}><Pencil size={15} /></button>
    <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.currentTarget.files?.[0];
      if (file) onFile(file);
      event.currentTarget.value = "";
    }} />
    {open && <div className="absolute left-1/2 top-full z-10 flex min-w-madevi-230 -translate-x-1/2 flex-col gap-madevi-4 rounded-madevi-18 border border-madevi-line bg-madevi-surface p-madevi-8 shadow-madevi">
      <button type="button" className="flex items-center gap-madevi-8 rounded-madevi-10 border-0 bg-madevi-soft p-madevi-9 text-left" onClick={() => { setOpen(false); picker.current?.click(); }}><Camera size={16} />{image ? t("Ubah foto", "Change photo") : t("Tambah foto", "Add photo")}</button>
      {image && <button type="button" className="flex items-center gap-madevi-8 rounded-madevi-10 border-0 bg-madevi-soft p-madevi-9 text-left" onClick={() => { setOpen(false); onRemove(); }}><Trash2 size={16} />{t("Hapus foto", "Remove photo")}</button>}
    </div>}
  </div>;
}
