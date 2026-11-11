# Kebutuhan layanan Madevi

Status: daftar persiapan, belum aktif atau diuji. Ade memilih penyedia, paket, anggaran, wilayah, waktu rilis, jadwal dan retensi. Siapkan lingkungan development, staging dan produksi terpisah; jangan kirim nilai rahasia melalui chat, Git, ZIP, log atau screenshot. Tidak semua layanan harus aktif bila fungsinya ditunda dan tetap tertutup.

| Layanan | Yang harus disiapkan atau diputuskan |
|---|---|
| Hosting | Server Node 24 dan kompatibilitas Next.js, user non-root, restart, akses privat dan health endpoint. Provider, paket, wilayah dan biaya belum dipilih. |
| Domain dan TLS | Domain/origin setiap environment, DNS, sertifikat HTTPS dan perpanjangan; origin persis diputuskan Ade. |
| PostgreSQL | Database baru yang terpisah per environment, akses jaringan terbatas, akun aplikasi berizin minimum dan TLS; `DATABASE_URL` adalah URI PostgreSQL privat. Jangan gunakan database development untuk pengguna nyata. |
| Backup | Lokasi terenkripsi yang terpisah; jadwal, retensi, enkripsi, pemegang akses dan drill restore menunggu keputusan Ade. Lihat `backup-restore.md`. |
| Email | SMTP dengan `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Pengirim dan penyedia dipilih Ade; uji verifikasi, perubahan email dan pemulihan di staging. |
| Google OAuth | Bila dipakai: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` dan callback `https://<origin-yang-disetujui>/api/auth/callback/google`. Uji login dan kelengkapan profil. |
| Proxy / edge | HTTPS, batas unggahan dan rate limit; tetapkan topologi tepercaya sebelum `TRUST_PROXY_HEADERS=true`. Proxy harus menimpa header IP, bukan meneruskan header sembarang. |
| Media / CDN | Saat ini media hanya disimpan di PostgreSQL. Pilih penyedia, kontrol akses privat dan retensi sebelum memindahkan media; adapter eksternal belum dibuat. |
| Cache | Pilih bila diperlukan; saat ini cache bersama belum tersedia. `CACHE_URL` hanya slot, bukan integrasi yang aktif. |
| Pencarian | Baseline PostgreSQL terbatas pada judul. Pencarian eksternal belum dipilih atau dibangun. |
| Monitoring | Penyedia, penerima alert, retensi log, eskalasi dan target kinerja belum dipilih. File contoh bukan monitoring aktif. |
| Rahasia | Secret manager atau environment privat server; `BETTER_AUTH_SECRET` acak minimal 32 karakter dan `BETTER_AUTH_URL` origin HTTPS yang disetujui. Setiap environment memakai rahasia berbeda. |
| Admin awal | `OWNER_USERNAME`, `OWNER_EMAIL`, `OWNER_PASSWORD` disediakan secara privat hanya saat bootstrap; aktifkan MFA dan simpan kode pemulihan secara aman. Ade tetap admin tunggal. |
| Repo / CI / image | Ade menentukan repository dan akses. Audit yang diterima dari pengembang melaporkan pipeline GitHub Actions berhasil pada commit 121c646, termasuk backup/restore database CI terisolasi; status run terbaru belum terverifikasi dari lingkungan ini. Dockerfile belum dibuktikan dibangun atau dijalankan. Jangan memberi rahasia CI pada PR tidak tepercaya. |
| Audit keamanan | Auditor independen, lingkup dan jadwal menunggu Ade; audit tidak digantikan tes otomatis. |
| Dukungan dan kebijakan | Kontak nyata, kebijakan privasi, ketentuan, perlindungan anak, penanganan laporan dan retensi menunggu keputusan/tinjauan Ade. |
| Analitik / realtime / pembayaran | Analitik dan realtime belum diaktifkan. Line tetap ditutup; pembayaran tidak termasuk cakupan. |

Sebelum staging atau produksi, `MADEVI_ENV` harus diset sesuai environment dan `MADEVI_DEMO_MODE=false`; akun demo tidak boleh dipindahkan. Slot `STORAGE_URL`, `CACHE_URL`, `LOG_LEVEL`, `BACKUP_DIR` belum membuktikan layanan terintegrasi.
