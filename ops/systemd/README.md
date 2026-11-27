# Jadwal operasi pada host Madevi

Jalur default memakai systemd pada host Linux yang menjalankan Docker Compose. Satu timer per tugas memberi ruang bagi alarm untuk berjalan saat proses backup lama atau PostgreSQL tidak dapat dihubungi. Gunakan nama tugas yang sudah ditetapkan. Berkas contoh di folder ini tersimpan di repositori sampai operator memasangnya.

## Siapkan akun proses dan environment

1. Siapkan akun layanan `madevi-ops` serta checkout yang dapat dibaca pada `/srv/madevi`. Pasang Node.js 24 dan klien PostgreSQL yang kompatibel. Jalankan `npm ci --omit=dev` di root. Sesuaikan jalur Node dan checkout dalam `madevi-task@.service` jika letaknya berbeda.
2. Buat `/etc/madevi/operations.env` dengan izin `0600` dan akses operator yang berwenang. Gunakan format `NAMA=nilai` dari [.env.example](../../.env.example) dengan nilai host. Isi `DATABASE_URL` untuk database aplikasi melalui koneksi langsung dan role runtime. Sertakan origin, mode dan konfigurasi dasar dari [panduan aktivasi](../../docs/aktivasi-default.md#3-isi-environment-server) supaya `ops:ready` dapat memeriksa kelompok lengkap. Gunakan kredensial yang berbeda dari staging.
3. Buat direktori privat mode `0700` di luar checkout untuk cadangan dan status alarm. Pastikan `madevi-ops` dapat menulis ke kedua lokasi. Simpan `MADEVI_BACKUP_KEY`, opsi `MADEVI_BACKUP_DATABASE_URL`, dan `MADEVI_RESTORE_DATABASE_URL` hanya pada host operasi. Akses Docker diperlukan untuk pergantian container. Akses soket Docker setara dengan kewenangan administrator host. Berikan kepada akun operasi yang dipercaya hanya jika katalog rollback diaktifkan. Proses web tetap berjalan tanpa soket tersebut. [Cadangan dan role](../backup-restore.md)
4. Jalankan pemeriksaan dari root checkout sebagai identitas proses dengan environment yang akan digunakan. Jika akun itu dapat membaca salinan env privat pada jalur yang dicontohkan, gunakan `node --env-file=/lokasi/privat/operations.env scripts/operations-readiness.mjs`. Periksa `ready`, `unconfigured`, `inactive`, `failed`, `stale`, dan `operator_check`. Pemeriksaan kelompok opsional bisa meminta tindakan operator dan endpoint live tetap mengukur proses. Verifikasi SMTP, mount baca-saja dalam container, kecocokan klien dan skema, serta target kosong secara terpisah. Jalankan perintah dengan hak akses yang sama dengan worker. [Kesiapan aplikasi](../../docs/aktivasi-default.md#4-inisialisasi-dan-periksa-kesiapan)

## Pasang setelah aktivasi disetujui

Salin tiga unit dari folder ini ke `/etc/systemd/system/`. Dari host jalankan:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now madevi-task@messages.timer madevi-task@operations.timer madevi-maintenance.timer
systemctl list-timers 'madevi-*'
sudo journalctl -u madevi-task@messages.service -u madevi-task@operations.service -u madevi-task@maintenance.service --since today
```

Saat SMTP dan penerima sudah diverifikasi, aktifkan unit alarm dengan `sudo systemctl enable --now madevi-task@alarm.timer`. Jalankan satu putaran manual melalui `sudo systemctl start madevi-task@operations.service` dan periksa waktu laporan di panel. Ulangi untuk `messages`, `maintenance` atau `alarm` sesuai kebutuhan di staging. Mulai alarm manual hanya ketika penerima menyetujui pengiriman.

Pesan, operasi, dan alarm berjalan satu menit setelah putaran masing-masing selesai. Maintenance berjalan per jam. Hentikan penjadwalan dengan `sudo systemctl disable --now` diikuti nama timer. Biarkan operasi yang sedang berjalan menyelesaikan pekerjaannya atau tangani sebagai insiden jika perlu dihentikan. Jangan menjalankan cron atau timer Compose kedua untuk pekerjaan yang sama.

Bila PostgreSQL kehilangan koneksi, worker keluar dengan status gagal dan memasukkan pemberitahuan ke journal. Penguncian PostgreSQL dilepas saat koneksi putus. Putaran berikutnya menandai operasi lama yang masih berjalan sebagai terputus. Untuk restore dan pergantian rilis, periksa target dan container sebelum mencoba kembali. Worker pesan memakai penguncian baris dan pembatas unik penerima. ID pekerjaan tersedia di riwayat panel dan journal operasi.

## Backup terjadwal, retensi dan salinan terpisah

- Pilih `MADEVI_ROUTINE_BACKUP_HOURS` antara 1 dan 720. Nilai `0` menonaktifkan jadwal. Antrean admin mendapat prioritas. Backup rutin memakai mesin enkripsi dan pemeriksaan integritas yang sama dengan backup panel, serta berbagi kunci penguncian. Percobaan yang gagal tetap dihitung untuk interval itu. Tinjau journal dan ajukan backup manual jika perlu.
- Gunakan `MADEVI_MAINTENANCE_MODE=dry-run` untuk melihat jumlah calon pembersihan per kelompok. Dari root, jalankan `npm run ops:maintenance -- --dry-run` dengan environment uji atau host yang dimaksud. Setelah meninjau kebijakan, `prune` membersihkan catatan limiter dan metrik per jam dalam batch dengan umur terpisah. `off` menunda pembersihan. Catatan audit, insiden, akun, percakapan dan konten dipertahankan.
- `MADEVI_BACKUP_RETENTION_DAYS` menentukan umur untuk tinjauan artefak. Tinjauan mengecualikan tiga backup terbaru, arsip yang terakhir berhasil dipulihkan, dan arsip yang dirujuk pekerjaan aktif. Scheduler mempertahankan semua berkas. Untuk penghapusan manual, periksa riwayat dan artefak yang sedang dirujuk, pastikan salinan masih dibutuhkan tersedia di lokasi terpisah, serta catat persetujuan, ID artefak, waktu dan hasil. Jalankan pada jendela pemeliharaan ketika pengajuan dan worker operasi dijeda. [Prosedur cadangan dan salinan](../backup-restore.md)
- Backup yang selesai telah dibuat dan lolos tag autentikasi AES-GCM. Menguji restore berarti membuka arsip pada database kosong terpisah dan memeriksa data yang dipulihkan. Simpan salinan arsip terenkripsi pada perangkat atau host terpisah dengan akses terbatas dan simpan kunci di tempat lain. Uji bahwa salinan dapat dibaca dan dipulihkan. Kehilangan host dapat menghilangkan seluruh cadangan lokal.

## Alarm SMTP dan respons gangguan

Gunakan konfigurasi SMTP yang sudah dipakai Madevi pada environment host alarm, isi `MADEVI_ALERT_TO` dengan satu alamat penerima, dan `MADEVI_OPS_STATE_DIR` dengan direktori privat di luar checkout. Gunakan penerima sintetis dan SMTP uji saat latihan. Penerima kosong menonaktifkan kanal.

Alarm memeriksa readiness loopback, usia laporan worker, kegagalan pekerjaan dalam satu jam terakhir, dan persentase ruang kosong pada filesystem backup. Default memerlukan tiga pengukuran gagal, mengulang paling banyak dua kali dengan jeda enam jam, lalu mengirim kabar pulih sekali ketika sinyal kembali baik. Kegagalan SMTP diberi jeda minimal 15 menit sebelum dicoba lagi dan berhenti setelah tiga upaya gagal pada tahap yang sama. Data tak terukur mempertahankan keadaan terakhir. Kegagalan kanal tercatat di journal.

Probe readiness dan file status `alarm-state.json` tetap dapat dipakai saat database gagal. Pengamatan antrean dari database berhenti selama koneksi putus. Bila mesin host atau koneksi SMTP ikut mati, operator perlu pemantauan dari luar host agar dapat menerima alarm. Ketidakpastian penerimaan SMTP saat koneksi terputus membatasi jaminan pengiriman tepat satu kali. Nama penerima dan kredensial tidak tersimpan pada file status. Pantau `journalctl -u madevi-task@alarm.service` untuk hasil dan pemulihan. [Respons insiden](../incident-response.md)
