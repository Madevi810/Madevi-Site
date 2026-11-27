import { lstatSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const paths=readFileSync(0,"utf8").split("\0");
if(!paths.some(Boolean))throw Error("Daftar berkas Git belum disediakan.");
const credentialPatterns=[
  /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/,
  /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{15,}\b/,
  /\bAIza[A-Za-z0-9_-]{35}\b/,
];
let findings=0;
for(const path of new Set(paths.filter(Boolean))) {
  let data;
  const name=basename(path);
  if((name.startsWith(".env")&&name!==".env.example")||/\.(?:pem|key|p12|gcm|dump)$/i.test(name)) {
    console.error("Berkas konfigurasi atau kunci terdeteksi:",JSON.stringify(path));
    findings++;
    continue;
  }
  if(!lstatSync(path,{throwIfNoEntry:false})?.isFile())continue;
  data=readFileSync(path);
  if(data.subarray(0,8192).includes(0))continue;
  if(credentialPatterns.some(pattern=>pattern.test(data.toString("utf8")))) {
    console.error("Pola kredensial terdeteksi:",JSON.stringify(path));
    findings++;
  }
}
if(findings)process.exitCode=1;
else console.log("Pemeriksaan pola secret pada isi repository lulus.");
