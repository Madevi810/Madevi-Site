# Laporan penataan Madevi

Dasar pemeriksaan 25 November 2026 adalah commit `0ed54b2` pada checkout `Madevi810/Madevi-Site`. Pohon kerja bersih saat dimulai. Konektor GitHub mengembalikan SHA yang sama pada riwayat commit terbaru.

## Temuan dan perubahan

| Temuan | Perubahan dan alasan |
| --- | --- |
| Empat file SQL mempunyai salinan identik untuk dibaca. Runner dan runtime Docker memakai `scripts/migrations`. | Hapus empat salinan di `database/migrations`; ganti dengan rujukan ke satu lokasi. Uji yang membandingkan salinan sekarang memeriksa pasangan up/down dan keberadaan satu lokasi. Empat file kanonis identik dengan commit awal, sehingga checksum dan alur migrasi dipertahankan. |
| Typecheck sebelumnya mengandalkan deklarasi route yang dibuat Next.js dan sempat masuk Git. | Kerjakan `next typegen` sebelum `tsc`; abaikan `next-env.d.ts` dan keluaran Playwright. Keluarkan backup dan hasil pengujian lokal dari konteks build. |
| Pemeriksaan impor ketat menemukan tujuh impor mati. Validasi kelengkapan SMTP juga terduplikasi. | Hapus impor tersebut dan satu konstanta gaya yang kehilangan pemakai. Gunakan `emailConfigured()` yang sudah dipakai aplikasi untuk guard pengiriman. |
| Kartu developer menampilkan ajakan meski URL sosial belum disediakan. Contoh env juga memuat empat slot layanan yang belum dipakai program. | Tampilkan status ketersediaan tautan dalam dua bahasa dan pertahankan ikon rancangan. Hapus slot cadangan dari contoh env. Kode runtime menentukan pasangan integrasi yang dipakai. |
| Batas body reverse proxy awal bisa menghentikan file laporan berukuran 2 MB karena overhead multipart. | Selaraskan contoh Caddy ke 2.200.000 byte, batas body pada route laporan. Keamanan dan batas ukuran berkas di aplikasi berlaku seperti sebelumnya. |
| README mencampur setup, status dan banyak catatan versi lama. Catatan kebutuhan layanan memuat status Docker yang bertentangan dengan laporan v17. | Jadikan README pintu masuk, AGENTS instruksi agent, CHANGELOG riwayat, dan `docs/` panduan. Pertahankan prosedur terperinci di `ops/` serta tandai bukti penyerahan v17 sebagai historis. Pondasi dipetakan dari paket lokal, tanpa menyalin ulang instruksi MEW. |

Struktur App Router, komponen, modul server, skrip dan aset publik sudah sesuai fungsi. Pemeriksaan rujukan menemukan penggunaan pada kedua font Noto Sans dan ilustrasi developer. File aset dan pemberitahuan lisensi dipertahankan. Build, PostCSS dan tes masih memakai dependensi yang terpasang, termasuk `postcss` pada tes tema. Cleanup ini tidak memerlukan perubahan lockfile atau nomor versi.

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm ci --no-audit --no-fund` pada folder sementara dengan manifest dan lockfile | Lulus, 101 paket. Percobaan pertama dibatasi akses jaringan sandbox, lalu berhasil dengan akses yang diperlukan. |
| `npm audit --omit=dev --audit-level=high` | Registry melaporkan 0 kerentanan. Cakupan audit adalah dependensi runtime. |
| `npm run typecheck`; `npm exec --offline -- tsc --noEmit --noUnusedLocals --noUnusedParameters` | Lulus. Typecheck juga lulus di salinan yang belum memiliki `.next` atau `next-env.d.ts`. |
| `npm test` | Lulus untuk 11 file tes. Pemeriksaan tambahan dengan `node --test --test-isolation=none --experimental-strip-types tests/*.test.ts` menampilkan 17 tes lulus. |
| `MADEVI_TEST_BUILD=1 MADEVI_VISUAL_CHECK=1 MADEVI_TEST_LOAD=1 MADEVI_CHROMIUM_PATH=/usr/bin/chromium npm run test:integration` | Lulus build Next.js dan integrasi PGlite/SMTP palsu. Chromium/axe lulus pada alur sidebar, login, profil, tema dan panel yang diuji. Pengujian beban ringan mencatat 30 permintaan, konkurensi 3 dan 0 error. Port loopback dibuka setelah percobaan awal ditolak sandbox. |
| `npm run test:integration` dengan PostgreSQL 18 lokal di container | Lulus migrasi ulang, pengaman rollback dengan data, API akun dan konten, MFA, pembatasan akses dan pemeriksaan kegagalan penyimpanan yang khusus PostgreSQL. SMTP memakai server palsu. |
| `npm run db:migrate`, `npm run db:create-owner` dan `next start` | Lulus pada database PostgreSQL 18 sintetis dan build lokal mode staging. Satu admin non-demo terbentuk, serta liveness dan readiness memberi HTTP 200. |
| `pg_dump -Fc` dan `pg_restore --exit-on-error` di PostgreSQL 18 lokal | Lulus ke database uji baru. Versi dan checksum migrasi hasil restore sama dengan sumber. Unit backup juga memeriksa perlindungan file, izin dan kegagalan dump. |
| Build dan runtime Docker lokal | Lulus memakai cache paket npm dari instalasi bersih. Dockerfile sementara mengganti langkah akses registry dengan `npm ci --offline`; tahap build dan runtime memakai instruksi repo. Container non-root menjalankan migrasi dan kedua probe, serta tidak membawa `.env.local`. |
| `docker compose config --quiet` dan `caddy validate` | Konfigurasi Compose server dan tes valid dengan env contoh. Contoh proxy valid pada Caddy 2.10. |
| Tautan Markdown, perintah, aset, env dan perubahan Git | Tautan/anchor internal mengarah ke file yang ada. Variabel contoh cocok dengan validasi runtime dan skrip bootstrap. Aset terhubung, SQL kanonis identik dan pola umum secret tidak ditemukan pada file perubahan. `git diff --check` lulus. |

## Batas verifikasi

- Build Docker dengan instalasi langsung ke registry mencapai batas waktu pada langkah `npm ci`, termasuk setelah percobaan ulang. Jalur cache membuktikan build dan runtime lokal. Build dengan database placeholder mencatat pesan Better Auth tentang pemeriksaan skema; migrasi dan probe lulus setelah runtime diberi database uji yang tersedia.
- GitHub Actions untuk perubahan lokal belum berjalan. Konektor hanya memberi status gabungan kosong dan daftar run pull request kosong untuk commit dasar. Status workflow push v17 belum dapat dipastikan dari data tersebut.
- Repo tidak mempunyai lint khusus. Pemeriksaan TypeScript dan impor dilakukan lewat perintah di atas.
- SMTP nyata, Google aktif, DNS, akses proxy di host tujuan, restore di provider, dan pengoperasian staging/produksi belum teruji. Pengujian browser menggunakan Chromium dan axe untuk skenario yang tersedia.
- Repo masih berstatus pengembangan lokal. Penyiapan penyedia, kebijakan data, audit akses dan kapasitas, serta pengisian dua ruang prioritas tercatat di [prioritas berikutnya](lanjutan.md) dan [persiapan online](online.md).
