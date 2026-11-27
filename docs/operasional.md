# Memelihara Madevi setelah online

Siapkan satu penanggung jawab, akses terbatas ke dashboard, catatan versi aplikasi, dan tempat aman untuk backup. Kerjakan latihan di staging sebelum produksi. Kode sudah memiliki probe, log terstruktur, dan [monitoring internal](operasi-admin.md#baca-monitoring). Siapkan penyedia monitoring, jadwal host, akses kunci, target terpisah, dan alarm setelah lingkungan tersedia.

## Pemeriksaan rutin

- Gunakan layanan monitoring untuk mengecek `/api/health/live` (proses menjawab) dan `/api/health/ready` (koneksi database dan migrasi tersedia). Tentukan interval, batas kegagalan berturut-turut, penerima alarm, dan petugas yang merespons. Uji alarm dan pulihnya secara terkendali pada staging.
- Pantau penggunaan penyimpanan PostgreSQL, durasi query, HTTP 5xx, kegagalan autentikasi, email tertolak, dan batas biaya. Pilih retensi log serta akses. Catat waktu kejadian dan commit. Hindari merekam URI database, password, token, isi email atau data pribadi. [Contoh monitoring](../ops/monitoring.example.yaml), [tata kelola data](../ops/data-governance.md)
- Jika readiness 503 dan liveness 200, periksa koneksi database, CA, akses jaringan, kuota dan status migrasi, indeks admin dan kolom bukti MFA. Jika keduanya gagal, periksa proses, port, HTTPS/proxy dan versi image. Kegagalan SMTP atau Google harus diuji dari alur pengguna karena probe tidak memeriksanya. [Respons insiden](../ops/incident-response.md)

## Backup dan latihan pemulihan

1. Pilih sasaran pemulihan. **RPO** adalah jumlah perubahan yang rela hilang sejak backup terakhir. **RTO** adalah batas waktu untuk memulihkan layanan. Gunakan sasaran itu untuk memilih frekuensi, retensi, tujuan penyimpanan terenkripsi, dan pemeriksaan kegagalan.
2. Dari root checkout operator, pasang klien PostgreSQL yang kompatibel. Siapkan role, direktori privat dan kunci di host. Jalankan `npm run db:backup:encrypted` dan `npm run db:verify:encrypted` dengan nama file yang dihasilkan. [Prosedur backup](../ops/backup-restore.md#buat-dan-periksa-cadangan)
3. Pulihkan cadangan terverifikasi ke database baru dan kosong. Bandingkan riwayat migrasi, contoh avatar, gambar pustaka dan laporan, akses admin, serta probe. [Langkah restore](../ops/backup-restore.md#pulihkan-ke-target-terisolasi)
4. Jadwalkan backup dan uji pengulangan secara berkala setelah prosedur manual lulus. Untuk media yang nanti dipindah keluar DB, buat jadwal backup media dan uji kesesuaiannya dengan referensi di database.

## Rollback dan pindah penyedia

Sebelum rilis, catat image lokal di katalog host, simpan salinan env privat, uji backup dan periksa daftar migrasi. [Rollback melalui panel](operasi-admin.md#pulihkan-pengaturan-dan-rilis) Jika aplikasi baru gagal, hentikan pengalihan traffic lalu jalankan image sebelumnya selama skema masih kompatibel. Bila ada perubahan data/skema yang tidak kompatibel, siapkan perbaikan maju atau latihan restore ke target terpisah. Perintah rollback uji di repo hanya berlaku pada database development kosong.

Untuk pindah hosting, buat lingkungan staging di tujuan, siapkan image dan akses DB, lalu uji semua jalur yang dipakai. Jika DB ikut pindah, rencanakan jeda penulisan, dump terakhir dan perpindahan data. Jika domain berganti, siapkan TLS/OAuth dan catat record lama. Alihkan traffic hanya setelah pemeriksaan lulus. Pertahankan akses ke sumber hingga berhasil memulihkan data dan membuktikan transisi. [Peta dan contoh perpindahan](ganti-layanan.md), [prosedur rilis](../ops/operations.md)
