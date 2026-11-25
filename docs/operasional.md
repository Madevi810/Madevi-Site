# Memelihara Madevi setelah online

Siapkan satu penanggung jawab, akses terbatas ke dashboard, catatan versi aplikasi, dan tempat aman untuk backup. Kerjakan latihan di staging sebelum produksi. Kode sudah memiliki probe dan log terstruktur. Penyedia monitoring, jadwal backup, enkripsi dan alarm aktif masih perlu disiapkan.

## Pemeriksaan rutin

- Gunakan layanan monitoring untuk mengecek `/api/health/live` (proses menjawab) dan `/api/health/ready` (koneksi database dan migrasi tersedia). Tentukan interval, batas kegagalan berturut-turut, penerima alarm, dan petugas yang merespons. Uji alarm dan pulihnya secara terkendali pada staging.
- Pantau penggunaan penyimpanan PostgreSQL, durasi query, HTTP 5xx, kegagalan autentikasi, email tertolak, dan batas biaya. Pilih retensi log serta akses. Catat waktu kejadian dan commit. Hindari merekam URI database, password, token, isi email atau data pribadi. [Contoh monitoring](../ops/monitoring.example.yaml), [tata kelola data](../ops/data-governance.md)
- Jika readiness 503 dan liveness 200, periksa koneksi database, CA, akses jaringan, kuota dan `002_notifications`. Jika keduanya gagal, periksa proses, port, HTTPS/proxy dan versi image. Kegagalan SMTP atau Google harus diuji dari alur pengguna karena probe tidak memeriksanya. [Respons insiden](../ops/incident-response.md)

## Backup dan latihan pemulihan

1. Pilih sasaran pemulihan. **RPO** adalah jumlah perubahan yang rela hilang sejak backup terakhir. **RTO** adalah batas waktu untuk memulihkan layanan. Gunakan sasaran itu untuk memilih frekuensi, retensi, tujuan penyimpanan terenkripsi, dan pemeriksaan kegagalan.
2. Dari root checkout operator, pasang alat klien PostgreSQL kompatibel dan siapkan URI/CA/role backup secara privat. Image Madevi tidak menyertakan `pg_dump`. Siapkan direktori privat di luar repo dan jalankan `npm run db:backup -- /direktori-privat/madevi-uji.dump`. Ganti jalur sesuai mesin. Skrip membuat satu file privat dan menolak menimpa target. Enkripsi dan simpan salinan terpisah. [Prosedur backup](../ops/backup-restore.md#backup-logis)
3. Pulihkan ke database **baru dan kosong** dengan `pg_restore` menurut [langkah restore](../ops/backup-restore.md#restore-terisolasi). Cek checksum migrasi, jumlah record, contoh avatar/gambar laporan, admin dan health. Catat waktu dan validasi akses. Jika restore gagal, periksa versi alat, format dump, ruang disk, hak akses, dan CA. Ulangi di database uji kosong baru.
4. Jadwalkan backup dan uji pengulangan secara berkala setelah prosedur manual lulus. Untuk media yang nanti dipindah keluar DB, buat jadwal backup media dan uji kesesuaiannya dengan referensi di database.

## Rollback dan pindah penyedia

Sebelum rilis, simpan identitas image/commit, salinan env privat, backup yang teruji, dan daftar perubahan skema. Jika aplikasi baru gagal, hentikan pengalihan traffic lalu jalankan image sebelumnya selama skema masih kompatibel. Bila ada perubahan data/skema yang tidak kompatibel, siapkan perbaikan maju atau latihan restore ke target terpisah. Perintah rollback uji di repo hanya berlaku pada database development kosong.

Untuk pindah hosting, buat lingkungan staging di tujuan, siapkan image dan akses DB, lalu uji semua jalur yang dipakai. Jika DB ikut pindah, rencanakan jeda penulisan, dump terakhir dan perpindahan data. Jika domain berganti, siapkan TLS/OAuth dan catat record lama. Alihkan traffic hanya setelah pemeriksaan lulus. Pertahankan akses ke sumber hingga berhasil memulihkan data dan membuktikan transisi. [Peta dan contoh perpindahan](ganti-layanan.md), [prosedur rilis](../ops/operations.md)
