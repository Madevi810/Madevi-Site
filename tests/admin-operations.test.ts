import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentType, downloadDisposition } from "../src/lib/library-file.ts";
import { availabilityInput, isAdminAvailable } from "../src/lib/support-availability.ts";
import { openBackup } from "../src/lib/backup-artifact.ts";

test("documents are identified by constrained content and served as attachments",()=>{
  assert.equal(documentType("hasil.CSV",Buffer.from('nama,nilai\n"Data, contoh",-4\n')),"text/csv");
  assert.equal(documentType("catatan.txt",Buffer.from("Uji UTF-8: é")),"text/plain");
  assert.equal(documentType("berkas.pdf",Buffer.from("%PDF-1.7\nxref\n0 1\n0000000000 65535 f \nstartxref\n9\n%%EOF\n")),"application/pdf");
  assert.throws(()=>documentType("berkas.pdf",Buffer.from("invalid")));
  assert.throws(()=>documentType("kode.txt",Buffer.from("<HTML>data</HTML>")));
  assert.throws(()=>documentType("catatan.txt",Buffer.from([0xc3,0x28])));
  assert.throws(()=>documentType("hasil.csv",Buffer.from("a,b\n1\n")));
  assert.throws(()=>documentType("hasil.csv",Buffer.from('a,b\n" =1+1",0\n')));
  assert.match(downloadDisposition("text/plain",'Berkas Ü\r\n"contoh".txt'),/^attachment; filename="lampiran\.txt"; filename\*=UTF-8''Berkas%20%C3%9C/);
  assert.equal(downloadDisposition("image/webp","Foto"),"inline");
});

test("weekly availability observes timezone boundaries and manual priority",()=>{
  const schedule=availabilityInput.parse({mode:"schedule",zone:"Asia/Jakarta",windows:[{day:1,start:"09:00",end:"17:00"}],awayReply:"Coba lagi."});
  assert.equal(isAdminAvailable(schedule,new Date("2026-11-30T01:59:00Z")),false);
  assert.equal(isAdminAvailable(schedule,new Date("2026-11-30T02:00:00Z")),true);
  assert.equal(isAdminAvailable(schedule,new Date("2026-11-30T10:00:00Z")),false);
  assert.equal(isAdminAvailable({...schedule,mode:"unavailable"},new Date("2026-11-30T02:00:00Z")),false);
  assert.equal(isAdminAvailable({...schedule,mode:"available"},new Date("2026-11-29T23:00:00Z")),true);
  assert.equal(availabilityInput.safeParse({...schedule,windows:[...schedule.windows,{day:1,start:"15:00",end:"20:00"}]}).success,false);
});

test("a backup descriptor accepts only a private real file inside the configured directory",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"madevi-unit-"));
  try {
    await writeFile(join(directory,"madevi-valid.dump.gcm"),Buffer.alloc(128),{mode:0o600});
    const {handle,size}=await openBackup(directory,"madevi-valid.dump.gcm");
    assert.equal(size,128);await handle.close();
    await symlink(join(directory,"madevi-valid.dump.gcm"),join(directory,"madevi-link.dump.gcm"));
    await assert.rejects(()=>openBackup(directory,"madevi-link.dump.gcm"));
    await assert.rejects(()=>openBackup(directory,"../madevi-valid.dump.gcm"));
    await writeFile(join(directory,"madevi-public.dump.gcm"),Buffer.alloc(128),{mode:0o644});
    await chmod(join(directory,"madevi-public.dump.gcm"),0o644);
    await assert.rejects(()=>openBackup(directory,"madevi-public.dump.gcm"));
  } finally{await rm(directory,{recursive:true,force:true});}
});
