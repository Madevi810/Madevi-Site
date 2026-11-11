# Database Madevi

Database Madevi dibuat baru pada lingkungan yang dipilih Ade; paket ini tidak berisi database atau data pengguna. Sumber tunggal migrasi yang dijalankan berada di `../scripts/migrations/`. Salinan di `migrations/` hanya rujukan; `npm test` menolak perbedaan isinya agar tidak menjadi sumber kedua. Ubah sumber utama dan perbarui salinannya bersama-sama. Jalankan `npm run db:migrate` setelah database PostgreSQL dikonfigurasi.

`seeds/` berisi contoh sintetis yang tidak otomatis dimuat. `backups/` hanya penanda folder, jangan simpan dump di repository. Backup nyata harus terenkripsi dan tersimpan di lokasi terpisah; lihat `../ops/backup-restore.md`.

Pisahkan database, akses, dan rahasia development, staging, serta production. Role aplikasi produksi tidak memakai hak superuser; PostgreSQL tidak dibuka ke internet. Penyedia, jadwal backup, retensi, dan lokasi penyimpanan belum dipilih.
