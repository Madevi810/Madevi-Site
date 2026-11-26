# Penyerahan Madevi kepada pemilik baru

Panduan ini dipakai bila kedua pihak menyetujui penyerahan. Kepemilikan repositori dan layanan, satu admin pengendali di aplikasi, dan akun pengguna adalah tiga hal berbeda. Siapkan lingkungan baru sebelum mengalihkan trafik. Inventarisasi data yang disepakati untuk dipindah dan siapa yang boleh menanganinya. Kebijakan lisensi, privasi dan transfer data memerlukan keputusan para pihak.

## 1. Catat apa yang diserahkan

- Repo beserta riwayat yang disetujui, versi/image yang berjalan, lockfile, migrasi, konfigurasi contoh, prosedur operasi dan daftar periksa. Sertakan lisensi serta atribusi komponen dan aset pihak ketiga yang ada. [Spesifikasi default](spesifikasi-default.md), [aktivasi](aktivasi-default.md)
- Untuk GitHub, host, database, DNS/domain, SMTP, Google, monitoring dan penyimpanan backup, catat siapa pemegang akun dan apakah akun bisa dialihkan atau layanan perlu dibuat ulang. Sertakan nama lingkungan, wilayah, penanggung jawab biaya, batas paket, akses pemulihan, dan cara menutup lingkungan lama.
- Kirim hanya data dan backup yang telah disepakati, terenkripsi dan diverifikasi dalam target uji. Catat media privat yang ikut PostgreSQL. Pisahkan kredensial dari repo dan dump.

## 2. Siapkan ulang akses layanan

Buat role database dan secret aplikasi milik pemilik baru. Ganti kredensial SMTP, OAuth dan proxy atau buat client serta pengirim baru. Sesuaikan origin/DNS dan redirect URI. Siapkan pengaturan pengiriman dan monitoring baru. Jika provider berbeda kontrak, gunakan [peta pergantian layanan](ganti-layanan.md) untuk memilih perubahan yang diperlukan.

Rencanakan penghentian sesi lama. Perubahan `BETTER_AUTH_SECRET` memengaruhi cookie, token dan data autentikator yang dienkripsi. Jika data pengguna dipindah, uji pemulihan dan penyiapan ulang MFA yang terdampak sebelum mengganti secret. Jadwalkan otp/tautan verifikasi yang sedang berjalan agar dapat diterbitkan ulang. Jangan gunakan secret lama untuk operasi normal pemilik baru.

## 3. Pindahkan kendali admin dengan satu akun aktif

- **Database baru tanpa identitas lama.** Setelah migrasi, pemilik baru menyiapkan variabel `OWNER_*` dan menjalankan `npm run db:create-owner`. Aktifkan MFA dan uji login ulang sebelum membuka staging.
- **Database dibawa beserta akun dan konten.** Cadangkan dan uji restore dahulu. Jadwalkan downtime pada target. Operator database yang diizinkan mengidentifikasi satu akun admin lama, mencabut sesi serta faktor pemulihannya, lalu menonaktifkan akses akun itu dan menurunkan perannya dari admin. Pertahankan record akun jika direferensikan konten. Verifikasi bahwa jumlah admin di target nol sebelum pemilik baru menjalankan bootstrap dengan identitas berbeda. Index unik dan bootstrap menolak admin kedua. Jangan mengubah database sumber selama latihan.
- Pastikan hanya admin baru yang dapat mengelola konten dan akun, login membutuhkan TOTP atau kode pemulihan yang baru, dan percobaan login serta sesi admin lama ditolak. Uji pengguna biasa tetap memakai alur akun sesuai konfigurasi baru.

## 4. Verifikasi dan cabut akses lama

Uji backup/restore, readiness, TLS, akun, media, SMTP dan Google bila digunakan, serta alarm. Catat waktu dan SHA rilis. Setelah trafik stabil, cabut akses pemilik/operator lama ke GitHub, SSH, penyedia, DNS, database, pengelola secret, integrasi CI, monitoring dan backup sesuai kesepakatan. Periksa deploy key dan akses yang pernah diberikan pada vendor. Pemilik baru memegang satu jalur pemulihan yang telah diuji. Data dan layanan lama dipertahankan, diarsipkan, atau dihapus setelah keputusan pemilik dan validasi masa pemulihan.
