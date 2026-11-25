# Catatan historis implementasi v0.0.0.17

Gunakan [indeks dokumentasi](docs/README.md) untuk kondisi proyek dan panduan terkini. Catatan di bawah merekam bukti pada saat penyerahan v17.

Status: WARNING. Aplikasi masih dalam pematangan dan belum siap untuk pengguna nyata.

- Versi tampilan v0.0.0.17; versi npm `0.0.0-17` adalah representasi teknis yang valid. Stack dan versi aktual tercantum dalam `package.json` dan lockfile.
- Satu akun dipakai bersama; admin non-demo memerlukan MFA. Akun demo dipertahankan hanya untuk development lokal terisolasi sesuai keputusan pengembang.
- Pendaftaran, sesi, profil, admin, notifikasi, dan laporan memiliki implementasi serta pengujian lokal. Foto profil diproses menjadi WebP dan disimpan di database. Login nomor telepon belum tersedia; Google OAuth belum diuji dengan penyedia asli.
- Typecheck, tes unit, build dan integrasi lokal telah dijalankan. Browser Chromium aplikasi telah diuji secara lokal, termasuk profil dan admin; cakupan aksesibilitas terbatas. Tes browser tidak termasuk dalam workflow CI saat ini.
- Menurut audit yang diterima dari pengembang, GitHub Actions untuk commit `121c646` berhasil, termasuk `pg_dump` dan `pg_restore` pada database CI terisolasi. Riwayat Pondasi juga mencatat CI v0.0.0.16 pada commit 11135d9 lulus. Status CI versi v0.0.0.17 perlu diperiksa pada GitHub Actions untuk commit terkait. Backup otomatis dan pemulihan di lingkungan tujuan belum dibuktikan.
- Komponen global lama telah dipindahkan ke utility Tailwind dalam lingkup yang diuji; audit visual dan aksesibilitas menyeluruh belum lengkap. Build dan runtime Docker lokal terverifikasi pada lingkup laporan `ops/verification-v17.md`.
- Catatan pengujian dan keputusan lengkap berada di Pondasi, yang dipelihara terpisah dari repo aplikasi. Lihat `README.md` dan `CHANGELOG.md` untuk ringkasan dalam repo.
