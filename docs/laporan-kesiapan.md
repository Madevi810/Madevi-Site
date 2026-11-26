# Bukti kesiapan integrasi default

Pemeriksaan 25 November 2026 memakai checkout Madevi berbasis V0.0.0.18. Perubahan kesiapan masuk dalam V0.0.0.19. Lingkungan uji memakai PostgreSQL 18 atau PGlite, akun dan data sintetis, Chromium lokal, dan SMTP palsu.

| Area | Bukti lokal |
| --- | --- |
| Konfigurasi dan kegagalan | `npm run typecheck` serta 21 tes unit lulus. Uji `check:ready` menolak konfigurasi kosong/parsial dan database yang tidak terjangkau tanpa mencetak nilai rahasia. Smoke runtime mengembalikan keadaan layanan opsional kosong dengan benar. |
| Admin, autentikasi dan akses | Suite berhasil menjalankan TOTP dan pemulihan satu kali. Sesi yang masih autentik tetapi tanpa bukti MFA ditolak API admin. Jalur pengaitan admin ditolak dari backend. Pemeriksaan identitas Google memakai email serta subjek yang sudah terhubung, diuji dengan fixture lokal. Pendaftaran email umum, penolakan origin berbeda dan pencabutan sesi tetap bekerja. |
| Pembatasan request | Suite menguji kuota akun lintas username/email, kuota browser terpisah, serta pengabaian header dari klien langsung. Unit memeriksa token proxy, IP yang valid, tanda tangan dan masa berlaku cookie. |
| Browser dan media | Chromium lulus untuk pendaftaran dengan foto, pengunggahan setelah verifikasi/login di tab yang sama, dan pembersihan storage. Uji tambahan pada PGlite membuktikan avatar lama tetap terbaca, penggantian menyimpan varian aktif, dan foto sementara yang rusak dibersihkan serta menghasilkan pesan yang jelas. Profil, panel admin dan pemeriksaan aksesibilitas yang tersedia lulus. Galeri README diambil ulang dan ditinjau. Hasil PNG identik dengan galeri terakhir. |
| Skema dan privilege | PostgreSQL 18 lulus migrasi kosong/ulang, posisi checksum, rollback uji terjaga, transaksi dan pemulihan saat dependensi skema/limiter sementara tidak tersedia. Role migrasi dan runtime non-superuser diuji. Runtime dapat membuat admin awal dan bootstrap kedua ditolak. Hak pembuatan objek skema serta mutasi riwayat migrasi tidak diberikan kepada runtime. |
| Build, probe dan backup | `MADEVI_TEST_BUILD=1 MADEVI_VISUAL_CHECK=1 MADEVI_TEST_LOAD=1 npm run test:integration` lulus dengan PostgreSQL 18 sintetis dan Chromium sistem. Runtime `next start` melayani beranda, liveness dan readiness. Dump PostgreSQL dipulihkan pada database kosong terpisah dan checksum ketiga migrasi cocok. Contoh Caddy lulus `caddy validate` dengan secret sintetis. |

Workflow CI memuat browser Chromium, runtime hasil build, PostgreSQL 18, role terpisah dan restore. Hasil di atas berasal dari perintah lokal yang setara. Workflow versi perubahan ini masih memerlukan eksekusi di GitHub.

Layanan tujuan dan kredensial tetap menunggu pemilik. SMTP palsu membuktikan alur aplikasi dan tidak menguji delivery nyata. Pengujian kebijakan Google tidak melakukan penukaran token dengan Google. Transport Google mengikuti batas internal Better Auth. Caddy membatasi waktu menunggu header upstream, sedangkan TLS publik, isolasi origin dan topologi proxy perlu diverifikasi di host pilihan. Pencadangan terjadwal, retensi dan monitoring aktif tetap menjadi langkah pengoperasian. [Panduan aktivasi default](aktivasi-default.md)

## Pemeriksaan rilis 26 November 2026

Pada V0.0.0.19, typecheck, 21 tes unit, build, smoke runtime, integrasi PostgreSQL 18, Chromium/axe, role terpisah dan backup/restore lulus ulang. Kelima cuplikan README diambil ulang dan diperiksa. Dashboard dan sidebar menampilkan versi rilis baru.
