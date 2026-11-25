# Database Madevi

Jalankan `npm run db:migrate` setelah PostgreSQL dan environment dikonfigurasi. Runner [scripts/migrate.mjs](../scripts/migrate.mjs) menyiapkan skema Better Auth dan tabel dasar, lalu menerapkan SQL berurutan dari [scripts/migrations](../scripts/migrations). Tabel `madevi_schema_migrations` menyimpan versi dan checksum migrasi Madevi. Perubahan skema memakai file baru serta pembaruan daftar versi pada runner.

Gunakan database, kredensial, dan akses terpisah untuk development, staging, dan produksi. Pakai role aplikasi berizin minimum dan koneksi dengan TLS pada hosting. Siapkan kredensial migrasi yang berhak mengubah skema secara terpisah saat konfigurasi provider mendukungnya, lalu uji bahwa role runtime dapat mengakses tabel dan sekuens yang dibutuhkannya.

[Fixture sintetis](seeds/README.md) menjelaskan bentuk data contoh. Simpan backup di luar repositori dan ikuti [prosedur backup dan restore](../ops/backup-restore.md). Baca [fondasi data](../docs/fundamental.md#data-konten-dan-media) untuk hubungan skema dengan fitur.
