# Operasi, pemulihan dan kriteria rilis

## Backup dan restore

Prosedur backup, restore terisolasi, verifikasi serta keputusan jadwal dan retensi ada di [backup-restore.md](backup-restore.md). Belum ada jadwal maupun layanan backup aktif.

## Penanganan insiden dan data

Lihat [incident-response.md](incident-response.md) dan [data-governance.md](data-governance.md). Keduanya masih rancangan dan belum menjadi bukti prosedur berjalan.

## Rilis dan rollback

1. Jalankan typecheck, unit/integrasi, audit dependensi, build, uji browser/aksesibilitas dan uji restore sesuai lingkungan.
2. Simpan versi image/build dan backup tervalidasi sebelum migrasi. Uji migrasi pada salinan data sintetis di staging; rencanakan kompatibilitas versi lama/baru.
3. Rilis ke staging, periksa `/api/health/live` dan `/api/health/ready` serta log; validasi layanan terkait. Baru rencanakan deployment produksi saat penyedia dan akses ditentukan.
4. Jika gagal, hentikan promosi; kembalikan image aplikasi sebelumnya jika masih kompatibel. Untuk perubahan data yang tidak kompatibel, gunakan strategi forward-fix atau pemulihan terverifikasi melalui prosedur pemilik; jangan otomatis melakukan `down` atau menimpa database produksi.

Rollback migrasi `npm run db:rollback:test` hanya di development, memerlukan `ALLOW_SCHEMA_ROLLBACK=true`, dan menolak database berisi data konten/media. Ini bukan mekanisme rollback produksi. Setiap update Madevi menaikkan angka terakhir satu tingkat: v0.0.0.1 → v0.0.0.2 → v0.0.0.3.

## Monitoring dan alert

`/api/health/live` menunjukkan proses melayani HTTP. `/api/health/ready` memeriksa koneksi dan versi skema database; tidak menguji SMTP, Google, backup, storage pihak ketiga, maupun integritas seluruh data. Logging JSON untuk respons login/MFA, rate limit dan aksi akun tidak memuat password, token, isi pesan, atau alamat email. Tabel audit menyimpan perubahan peran dan aksi penting; akses dan retensi harus dibatasi.

Usulan alert setelah memilih layanan: readiness gagal, error 5xx meningkat, p95 melambat, database/storage hampir penuh, backup gagal dan restore gagal. Tentukan penerima dan eskalasi; tidak ada collector, alert, scheduler, atau pemantauan 24 jam yang aktif sekarang.

## Performa

Budget awal uji lokal ringan (bukan SLA): 30 permintaan GET berurutan/kecil dengan rasio gagal 0 dan p95 < 2 detik pada lingkungan test. Catat jenis mesin dan skenario saat mengukur. Gunakan uji beban yang disepakati pada staging untuk menentukan jumlah pengguna, p95, error rate dan biaya sebelum mengklaim kapasitas.
