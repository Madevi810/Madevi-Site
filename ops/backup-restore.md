# Backup terenkripsi dan pemulihan Madevi

Pekerjaan standar berjalan di host operasi yang dikuasai pemilik. Riwayat dicatat di PostgreSQL dan terlihat pada **Database & Pemulihan**. Host perlu PostgreSQL client yang kompatibel dengan versi server, Node.js 24, akses database melalui role yang tepat, direktori privat, dan ruang penyimpanan. Image aplikasi berisi skrip dan memakai PostgreSQL sebagai sumber data tunggal. Pasang `pg_dump` dan `pg_restore` pada mesin operator. Siapkan scheduler dan tempat salinan sesuai kebijakan pemilik. Untuk pengajuan melalui panel, gunakan [worker operasi admin](../docs/operasi-admin.md).

## Siapkan akses, direktori, dan kunci

1. Buka terminal privat di **root Madevi-Site**. Masuk melalui akun operator yang dipegang pemilik. Gunakan akses SSH dengan MFA/konfirmasi ulang identitas sesuai kebijakan host untuk operasi pemulihan.
2. Isi `DATABASE_URL` dengan role runtime yang dapat mencatat riwayat pekerjaan. Bila memiliki role baca khusus backup, tambahkan `-v backup=madevi_backup` saat menerapkan [contoh hak psql](../database/roles.example.sql) untuk role yang telah dibuat, lalu isi `MADEVI_BACKUP_DATABASE_URL` dengan alamat server, port dan database yang sama. Pakai koneksi langsung untuk mempertahankan PostgreSQL advisory lock, yaitu kunci yang mencegah pekerjaan berjalan bersamaan.
3. Siapkan direktori di luar checkout, misalnya `/srv/madevi-backup`, dengan mode `0700`. Batasi pemilik direktori ke akun operasi. Direktori harus mendukung hard link lokal. Hasil cadangan dibuat dengan mode `0600`.
4. Buat kunci AES-256, yaitu 32 byte acak. Jalankan perintah berikut di terminal privat, pindahkan hasil ke pengelola rahasia, lalu sediakan sebagai `MADEVI_BACKUP_KEY` melalui env milik host. Labeli kunci dengan generasi dan simpan salinan pemulihan terpisah dari file backup. Simpan kunci generasi sebelumnya selama cadangannya masih perlu dipulihkan.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Pakai `MADEVI_BACKUP_DIR=/srv/madevi-backup` sebagai contoh jalur. Rahasia, URI lengkap, dan data pengguna disimpan di host operasi dan pengelola rahasia. Env backup bisa hanya tersedia di proses operator. Panel tetap membaca riwayat melalui PostgreSQL.

## Buat dan periksa cadangan

```bash
npm run db:backup:encrypted
npm run db:verify:encrypted -- madevi-2026-11-26t12-00-00-000z-bbbbbbbb.dump.gcm
```

Ganti nama contoh dengan nama aktual yang tercetak. `pg_dump` menghasilkan format PostgreSQL custom untuk database Madevi. Instalasi default menggunakan skema `public`. Hasil mengalir ke enkripsi AES-256-GCM sebelum ditulis ke disk. GCM memeriksa integritas melalui tag autentikasi. Skrip memeriksa tag sebelum menyerahkan file akhir. Panel mencatat nama, waktu, ukuran, durasi, dan hasil pekerjaan. Pekerjaan gagal menghasilkan kode keluar selain nol dan alasan aman. Periksa izin direktori, koneksi, TLS, ruang disk, dan versi alat sebelum mencoba lagi.

Simpan salinan terenkripsi di penyimpanan terpisah yang disetujui. Uji tag pada salinan dan pulihkan secara berkala. PostgreSQL menyimpan gambar pustaka, avatar dan foto laporan sehingga ketiganya ikut backup. File environment, kunci, aset statis repo, konfigurasi proxy dan peran database perlu disiapkan atau dicadangkan lewat prosedur masing-masing. Perintah pra-fondasi `db:backup` menghasilkan dump mentah untuk kebutuhan kompatibilitas. Gunakan cadangan terenkripsi untuk operasi normal.

## Pulihkan ke target terisolasi

1. Buat database baru dengan nama seperti `madevi_restore_latihan` dan role khusus yang boleh menulis di target tersebut. Target harus kosong. Jaga akses jaringan target agar hanya operator yang menggunakannya selama pemulihan.
2. Masukkan URI target secara privat pada `MADEVI_RESTORE_DATABASE_URL`. Pertahankan konfigurasi sumber untuk kunci dan pencatatan. Gunakan file sementara terenkripsi pada host untuk tahap dekripsi dengan menetapkan `TMPDIR` ke filesystem privat yang terenkripsi. Skrip membersihkan dump sementara pada akhir operasi berjalan normal atau gagal.
3. Verifikasi nama, host, port dan dampaknya pada sesi operator yang terautentikasi ulang. Jalankan dari root dengan nama berkas aktual dan konfirmasi target lengkap.

```bash
npm run db:restore:encrypted -- madevi-2026-11-26t12-00-00-000z-bbbbbbbb.dump.gcm RESTORE:db-uji.example.invalid:5432/madevi_restore_latihan
```

4. Skrip memeriksa identitas dan kekosongan target, mengautentikasi semua ciphertext sebelum restore, dan memulihkan dalam satu transaksi. Riwayat pekerjaan disimpan di database sumber. Setelah hasil berhasil, cocokkan checksum migrasi, jumlah data penting, dan sampel media. Pastikan role migrasi memiliki objek dan terapkan izin runtime dengan [contoh role](../database/roles.example.sql).
5. Untuk latihan, uji aplikasi di staging dengan target terpisah. Untuk pengalihan sungguhan, hentikan penulisan lama pada waktu yang disetujui, simpan data lama, verifikasi target, ubah koneksi aplikasi secara terkendali dan jalankan `npm run check:ready`. Catat rute untuk kembali ke sumber sebelumnya dan bagaimana menyelaraskan perubahan sejak pengalihan.

`db:verify:encrypted` memeriksa kunci serta integritas. Uji pemulihan, login, akses media dan kontrol publikasi pada target untuk membuktikan data bisa digunakan.

## Retensi dan jenis pemulihan

Tetapkan frekuensi dan umur salinan dari target kehilangan data maksimum (RPO) dan target durasi pemulihan (RTO). Ambil daftar file serta pekerjaan yang telah selesai. Sebelum menghapus artefak lama, periksa minimal satu salinan yang lebih baru telah diverifikasi dan bisa dipulihkan, serta tidak ada proses aktif. Lakukan penghapusan berdasarkan nama file yang telah disetujui, satu per satu pada host, dan catat tindakan sesuai kebijakan. Pertahankan kunci selama artefak terkait masih dapat dipakai. Ukur pertumbuhan `madevi_rate_limits` dan `madevi_security_events` sebelum mengatur retensi. Uji pembersihan batch di lingkungan sintetis dan pertahankan entri yang masih diperlukan untuk penyelidikan.

| Yang dipulihkan | Langkah |
| --- | --- |
| Revisi konten | Di admin, pilih revisi sebelumnya dan pulihkan sebagai draf. |
| Konfigurasi | Kembalikan versi env/proxy pada host, restart dan periksa kesiapan. |
| Rilis aplikasi | Jalankan image sebelumnya bila kompatibel dengan skema. |
| Database | Pulihkan cadangan terverifikasi ke database baru, lalu alihkan setelah persetujuan. |
| Media | Gambar di PostgreSQL ikut backup. Verifikasi hubungan file dengan konten dan izin penerima setelah restore. Aset Git berasal dari checkout rilis. |
