# Backup dan pemulihan database

**Status: rancangan; backup logis dan restore di lingkungan tujuan belum diuji.** Database Madevi akan dibuat baru. Tidak ada scheduler, enkripsi terkonfigurasi, atau penyimpanan terpisah yang sudah aktif.

## Keputusan yang masih terbuka

- Jadwal dan retensi backup: belum diputuskan Ade.
- Lokasi terpisah dan cara enkripsi/akses: belum diputuskan Ade.
- Jadwal pembersihan rate limit dan retensi peristiwa keamanan: belum diputuskan; tidak ada scheduler aktif.
- Pemilik operasi, prosedur pemantauan kegagalan, dan uji restore berkala: belum ditetapkan.

## Backup logis

Konfigurasikan akses database melalui environment privat, dengan izin minimum dan PostgreSQL client `pg_dump` yang kompatibel. Siapkan tujuan di direktori privat sementara di luar repository; nilai contoh di bawah adalah jalur lokal, bukan layanan yang sudah disiapkan. Jangan menaruh password pada baris perintah atau mencetak connection string.

```sh
npm run db:backup -- /direktori-privat/madevi.dump
```

Skrip menolak tujuan di dalam folder project dan tujuan yang sudah ada, memakai berkas privat sementara dan hanya menyerahkan hasil yang tidak kosong setelah `pg_dump` berhasil. Tujuan harus mendukung hard link pada filesystem yang sama; fitur ini belum diuji pada provider. Enkripsi backup dan simpan salinannya di lokasi terpisah yang disetujui; batasi akses dan periksa keberhasilannya. Jangan simpan dump di `database/backups/`, Git, ZIP, atau server yang sama sebagai satu-satunya salinan.

## Restore terisolasi

Buat database pengujian **baru dan kosong** yang terpisah dari seluruh database yang sedang dipakai. Konfigurasikan `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSFILE` dan `MADEVI_RESTORE_DB_NAME` secara privat; yang terakhir hanya nama database uji, bukan URL atau password. Periksa identitas tujuan dan pastikan tabel di schema `public` belum ada sebelum menjalankan restore.

```sh
psql --dbname="$MADEVI_RESTORE_DB_NAME" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
# Lanjut hanya bila hasilnya 0 dan tujuan telah diverifikasi sebagai database uji terpisah.
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$MADEVI_RESTORE_DB_NAME" /direktori-privat/madevi.dump
```

Bandingkan versi dan checksum migrasi, jumlah record, serta login akun pengujian dengan sumber menggunakan jalur administrasi terbatas. Catat tanggal, lingkungan, ukuran dump, hasil dan lokasi bukti tanpa rahasia. Hapus data uji sesuai kebijakan; jangan pernah menimpa produksi. Uji rollback migrasi hanya untuk database development kosong dengan pengaman skrip, bukan staging atau produksi berdata.

## Pembersihan manual

Sampai retensi dan scheduler disepakati, **jangan menghapus peristiwa keamanan berdasarkan angka asumsi**. Admin dapat memeriksa jumlah dan rentang tanggal `madevi_rate_limits` dan `madevi_security_events` secara read-only. Susun perintah pembersihan dengan ambang yang disetujui, uji di database sintetis lalu catat setiap pelaksanaan manual. Scheduler otomatis masih belum aktif.
