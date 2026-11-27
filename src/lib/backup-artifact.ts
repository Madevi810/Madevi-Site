import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, resolve, join } from "node:path";

export const backupName = /^madevi-[a-z0-9-]{1,100}\.dump\.gcm$/;

export async function backupDirectory(directory:string) {
  if(!isAbsolute(directory) || await realpath(directory)!==resolve(directory)) throw Error("Direktori backup harus memakai jalur langsung.");
  const metadata=await lstat(directory);
  if(!metadata.isDirectory() || (metadata.mode&0o077)!==0) throw Error("Direktori backup harus privat (0700).");
  return directory;
}

export async function openBackup(directory:string,name:string) {
  if(!backupName.test(name))throw Error("Nama artefak tidak valid.");
  const filename=join(await backupDirectory(directory),name);
  const link=await lstat(filename);
  if(!link.isFile() || (link.mode&0o077)!==0)throw Error("Artefak backup harus berupa berkas privat.");
  const handle=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const stat=await handle.stat();
    if(!stat.isFile()||stat.ino!==link.ino||stat.dev!==link.dev||stat.size<=36)throw Error("Berkas backup tidak valid.");
    return {handle,size:stat.size};
  } catch(error){await handle.close();throw error;}
}
