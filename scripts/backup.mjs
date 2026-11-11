import { spawn } from "node:child_process";
import { mkdtemp, open, link, realpath, rm } from "node:fs/promises";
import { dirname, basename, join, relative, resolve, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL || !process.argv[2]) throw new Error("DATABASE_URL dan tujuan file backup wajib diisi.");
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const supplied = resolve(process.argv[2]);
const destinationDirectory = await realpath(dirname(supplied));
const withinProject = relative(root, destinationDirectory);
const outsideProject = withinProject === ".." || withinProject.startsWith(`..${sep}`) || isAbsolute(withinProject);
if (!outsideProject) {
  throw new Error("Backup harus disimpan di luar folder project.");
}
const target = join(destinationDirectory, basename(supplied));
const stagingDirectory = await mkdtemp(join(destinationDirectory, ".madevi-backup-"));
const temporary = join(stagingDirectory, "backup.tmp");
let file;
try {
  file = await open(temporary, "wx", 0o600);
  const result = await new Promise((resolveRun, reject) => {
    const child = spawn("pg_dump", ["--format=custom"], {
      env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
      stdio: ["ignore", file.fd, "ignore"]
    });
    child.once("error", () => reject(new Error("pg_dump tidak tersedia atau tidak dapat dijalankan.")));
    child.once("close", (code, signal) => resolveRun({ code, signal }));
  });
  const size = (await file.stat()).size;
  await file.close(); file = undefined;
  if (result.code !== 0) throw new Error("Backup gagal; periksa koneksi dan izin database secara privat.");
  if (size === 0) throw new Error("Backup kosong dan tidak disimpan.");
  // Exclusive link is atomic on the same filesystem and fails if target exists.
  await link(temporary, target);
  console.log("Backup selesai. Lindungi file dan uji pemulihannya pada database uji terpisah.");
} catch (error) {
  if (error?.code === "EEXIST") throw new Error("Tujuan backup sudah ada; pilih nama baru.");
  throw error;
} finally {
  if (file) await file.close();
  await rm(stagingDirectory, { recursive: true, force: true });
}
