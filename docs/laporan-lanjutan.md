# Verifikasi galeri dan panduan Madevi

Pemeriksaan dilakukan pada 25 November 2026 di Madevi-Site V0.0.0.17, checkout lokal berbasis commit `0ed54b2`. Perubahan penataan sebelumnya telah ada di pohon kerja saat dimulai. Tugas ini menambahkan skrip screenshot, gambar, dan panduan. Alur aplikasi, konfigurasi layanan dan aturan akses memakai implementasi yang sudah ada.

| Pemeriksaan | Hasil dan batas |
| --- | --- |
| ZIP Pondasi | `BACA-REFERENSI.md` dan `PROMPT-LANJUTAN.md` dibaca. SHA-256 seluruh 208 berkas Pondasi cocok dengan inventaris. Temuan konflik status, susunan lama, dan penanda versi dicatat di [pemetaan](referensi-pondasi.md). |
| `MADEVI_CHROMIUM_PATH=/usr/bin/chromium npm run screenshots` | Lulus dua kali dengan Chromium sistem, Next.js dan database PGlite sementara. Login profil dan admin memakai formulir serta akun demo sintetis. Percobaan pertama menemukan avatar kosong masih dalam transisi dari 404 ke ikon bawaan. Skrip kini menunggu gambar atau pengganti siap. |
| Konsistensi dan pemeriksaan visual | Lima hash PNG sama pada dua pengambilan yang berhasil. Beranda ponsel 390×844. Empat gambar desktop 1440×900. Kelima gambar ditinjau, termasuk status profil, dashboard admin, navigasi, dan tidak adanya data pengguna nyata atau rahasia. |
| Setup panduan lokal | Instalasi bersih dari lockfile memakai cache npm. PostgreSQL 18 dari Compose uji mencapai healthy. Migrasi, seed demo, `npm run dev -- --port 3100`, beranda dan readiness lulus pada checkout sementara. Override Compose staging lulus `config --quiet`. |
| Kode | `node --check scripts/screenshots.mjs`, `npm run typecheck`, dan 17 tes unit lulus. Galeri sendiri menguji Next.js, migrasi, sesi login demo, data profil serta readiness admin. |
| `npm run test:integration` | Lulus dengan PGlite dan SMTP palsu, termasuk alur akun, admin, MFA dan pembatasan akses. Pemeriksaan fault injection khusus PostgreSQL tidak dijalankan pada PGlite. |
| Sumber layanan | Paket dan batas Render, Neon, DigitalOcean serta Postmark dan petunjuk resmi TLS, SMTP serta OAuth diperiksa 25 November 2026. Harga dan kuota di [panduan online](online.md#dua-jalur) adalah contoh pada tanggal pemeriksaan. |
| Tautan dan isi | Path gambar dan dokumen, anchor, skrip npm, nama env pada tabel perpindahan, dan route yang dirujuk dicocokkan dengan tree aplikasi. `git diff --check` lulus. |

Hosting, DNS/TLS publik, database online, SMTP nyata, Google OAuth aktif, penyimpanan cloud, alarm, dan latihan pemulihan pada provider menunggu konfigurasi dan pengujian nyata. GitHub Actions untuk perubahan lokal belum berjalan. Langkah berikutnya bagi pemilik adalah memilih jalur dan menyiapkan host, PostgreSQL, HTTPS serta secret menurut [urutan panduan](README.md).

## Pemeriksaan ulang V0.0.0.18

Lima screenshot diambil ulang dan diperiksa menggunakan tampilan aplikasi V0.0.0.18. Typecheck, 17 tes unit, dan build dengan `MADEVI_TEST_BUILD=1 npm run test:integration` pada PostgreSQL 18 lokal lulus. Pengujian memakai SMTP palsu. Pemeriksaan tautan, variabel contoh, route, dan blok versi README juga lulus.
