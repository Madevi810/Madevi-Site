const documentMime = {pdf:"application/pdf",txt:"text/plain",csv:"text/csv"} as const;
const extensionFor:Record<string,string> = {"application/pdf":"pdf","text/plain":"txt","text/csv":"csv","image/webp":"webp"};
export const libraryMaxFile=2_000_000;
export const libraryMaxTotal=256_000_000;

export function isDocumentName(name:string) {
  return /\.(?:pdf|txt|csv)$/i.test(name);
}

function validateCsv(text:string) {
  // Parse commas, CR/LF and quoted fields without interpreting cell contents.
  const token=/(?:"(?:[^"]|"")*"|[^",\r\n]*)(?:,|\r?\n|$)/gy;
  let offset=0, width=0, firstWidth=0;
  while(offset<text.length) {
    token.lastIndex=offset;
    const match=token.exec(text);
    if(!match||token.lastIndex===offset)throw Error("Struktur CSV tidak valid.");
    offset=token.lastIndex;width++;
    const cell=match[0].replace(/(?:,|\r?\n)$/,"").replace(/^"|"$/g,"").trimStart();
    if(/^[=+@-]/.test(cell)&&!/^[-+]?\d+(?:\.\d+)?\s*$/.test(cell))throw Error("Formula spreadsheet tidak diizinkan.");
    if(!match[0].endsWith(",")||offset===text.length) {
      if(match[0].endsWith(","))width++;
      if(firstWidth&&width!==firstWidth)throw Error("Jumlah kolom CSV harus konsisten.");
      firstWidth=width;width=0;
    }
  }
}

export function documentType(name:string,data:Buffer) {
  if(!data.length||data.length>libraryMaxFile)throw Error("Ukuran lampiran tidak valid.");
  const suffix=name.split(".").at(-1)?.toLowerCase();
  if(suffix==="pdf") {
    const header=data.subarray(0,16).toString("latin1");
    const trailer=data.subarray(Math.max(0,data.length-2048)).toString("latin1");
    const index=Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(trailer)?.[1]);
    const xref=Number.isSafeInteger(index)&&index>=9&&index<data.length?data.subarray(index,index+2048).toString("latin1"):"";
    if(!/^%PDF-(?:1\.[0-7]|2\.0)\r?\n/.test(header)
      ||!(/^(?:xref\s+\d+\s+\d+|\d+\s+\d+\s+obj\s*<<[\s\S]*?\/Type\s*\/XRef\b)/.test(xref))) {
      throw Error("Struktur PDF tidak valid.");
    }
    return documentMime.pdf;
  }
  if(suffix!=="txt"&&suffix!=="csv")throw Error("Format dokumen tidak didukung.");
  const text=new TextDecoder("utf-8",{fatal:true}).decode(data);
  if(!text.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
    ||/^\s*(?:<\?xml|<!doctype\s+html|<html\b|<svg\b|<script\b|<iframe\b)/i.test(text))throw Error("Gunakan dokumen teks sederhana UTF-8.");
  if(suffix==="csv")validateCsv(text);
  return documentMime[suffix];
}

export function downloadDisposition(mime:string,name:string) {
  const suffix=extensionFor[mime];
  if(!suffix)throw Error("Jenis lampiran tidak didukung.");
  if(mime==="image/webp")return "inline";
  const base=Array.from(name.normalize("NFC").replaceAll(/[^\p{L}\p{N} ._-]/gu,"_").trim().replace(/\.(?:pdf|csv|txt)$/i,"")).slice(0,100).join("")||"lampiran";
  return `attachment; filename="lampiran.${suffix}"; filename*=UTF-8''${encodeURIComponent(base+"."+suffix)}`;
}
