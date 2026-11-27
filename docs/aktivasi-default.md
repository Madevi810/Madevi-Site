# Aktivasi default Madevi

Ikuti urutan ini untuk staging dengan data sintetis, lalu ulangi dengan konfigurasi produksi yang terpisah setelah hasil staging disetujui. Gunakan [panduan lokal](lokal.md) jika hanya ingin mencoba di komputer. Saat ini belum ada deployment atau kredensial penyedia yang diisikan.

## 1. Siapkan akses dan pilih layanan

- Siapkan checkout Madevi-Site, Node.js 24 dan npm di mesin operator, satu server Linux dengan Docker Compose, akses SSH yang dikuasai pemilik, dan PostgreSQL 18 yang dapat dijangkau server. Gunakan satu database per lingkungan.
- Siapkan nama host staging dan akses DNS. Untuk jalur Compose, gunakan Caddy pada host dan sertifikat HTTPS. Port 80/443 menghadap publik, sedangkan port aplikasi tetap loopback.
- Buat akun layanan yang dibutuhkan atas nama pemilik. SMTP diperlukan saat membuka pendaftaran email. Google bersifat opsional untuk pengguna biasa. Avatar, gambar laporan, dan pustaka lampiran tetap di PostgreSQL. Contoh penyedia dan harga ada sebagai [opsi tambahan](online.md#dua-jalur).

## 2. Ambil nilai dan pisahkan role

1. Buat database khusus Madevi serta role login migrasi dan runtime. Simpan nama host, port, database, role/password dan CA dari penyedia. Pastikan aturan jaringan mengizinkan server dan mesin yang akan menjalankan migrasi. Gunakan URI seperti `postgresql://ROLE:PASSWORD_ENCODED@HOST:PORT/DB?sslmode=verify-full`. Gunakan `sslrootcert` bila penyedia meminta CA terpisah. Dalam container path CA harus dapat dibaca user non-root.
2. Dari root repo, gunakan [contoh role SQL](../database/roles.example.sql) dengan operator database yang berhak. Kedua role dibuat terlebih dahulu. Pada database baru, jalankan contoh sebelum migrasi dan ulangi sesudahnya supaya role runtime hanya bisa membaca tabel riwayat migrasi. Jika database lama sudah berisi tabel milik role lain, periksa dan alihkan kepemilikan objek kepada role migrasi secara terkontrol.
3. Tentukan origin persis, misalnya `https://staging.example.invalid`. Arahkan DNS ke proxy ketika layanan siap. Generate secret menggunakan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` dalam terminal privat. Pakai nilai berbeda untuk `BETTER_AUTH_SECRET` dan `MADEVI_PROXY_SECRET`. Simpan dalam pengelola secret.

Contoh role dijalankan dari terminal dengan koneksi operator yang telah disiapkan secara privat. `PGHOST`, `PGPORT`, `PGUSER`, metode password dan CA berasal dari pengaturan PostgreSQL, sedangkan `PGDATABASE` harus menunjuk database khusus Madevi.

```bash
psql -X -v migrator=madevi_migrator -v runtime=madevi_runtime -f database/roles.example.sql
```

## 3. Isi environment server

Gunakan [.env.example](../.env.example) sebagai daftar nama. Di root checkout server, Compose produksi membaca `.env.production`. Untuk staging gunakan `.env.staging` dan [override Compose](online.md#2-isi-environment-dari-sumber-yang-tepat). Simpan file dengan izin baca minimum, di luar Git serta tangkapan layar.

| Isi | Sumber dan tujuan |
| --- | --- |
| `MADEVI_ENV=staging` atau `production`, `MADEVI_DEMO_MODE=false` | Pilih lingkungan sesuai host. Samakan mode pada Compose override dan file env. |
| `DATABASE_URL` | URI role runtime dan TLS dari langkah 2. Siapkan URI langsung role migrasi secara privat untuk job satu kali. Koneksi migrasi perlu mempertahankan advisory lock pada satu sesi, sehingga tidak memakai pooler mode transaksi. |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Origin HTTPS tanpa path, dan secret dari langkah 2. |
| `MEDIA_BACKEND=postgres` | Penyimpanan yang sudah didukung. |
| `TRUST_PROXY_HEADERS`, `MADEVI_PROXY_SECRET` | Biarkan trust `false` sampai Caddy menimpa kedua header privat, origin tidak bisa dilewati dan batas request diuji. Jalur default setelah verifikasi memakai `true`. [Konfigurasi proxy](../ops/reverse-proxy.example.md) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Di provider SMTP, verifikasi alamat/domain pengirim dan ambil host, port, username serta password/token SMTP. Pilih port TLS yang dapat dijangkau host. Isi kelima nilai, atau biarkan semuanya kosong. [Langkah email](siapkan-layanan.md#smtp-dan-pengirim--wajib-jika-membuka-pendaftaran-email) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Buat OAuth client aplikasi web dan masukkan `<origin>/api/auth/callback/google` pada daftar redirect. Pakai client staging terpisah. Isi pasangan atau biarkan kosong. Google untuk pengguna biasa. [Langkah Google](siapkan-layanan.md#google-oauth--opsional) |
| `OWNER_USERNAME`, `OWNER_EMAIL`, `OWNER_PASSWORD` | Masukkan hanya pada job bootstrap. Gunakan identitas pemilik dan password unik 12–128 karakter. Hapus variabel bootstrap setelah admin dibuat. |

Jika memakai contoh provider, ketentuan teknis PostgreSQL, SMTP, proxy dan OAuth diperiksa 25 November 2026. [TLS node-postgres](https://node-postgres.com/features/ssl), [SMTP Nodemailer](https://nodemailer.com/smtp.html), [Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)

## 4. Inisialisasi dan periksa kesiapan

Jalankan dari root. Untuk lingkungan staging, tambahkan opsi project dan override Compose pada setiap perintah Docker sesuai [contoh staging](online.md#2-isi-environment-dari-sumber-yang-tepat).

```bash
docker compose build madevi
# Muat DATABASE_URL role migrasi di shell privat hanya untuk perintah ini.
docker compose run --rm -e DATABASE_URL madevi npm run db:migrate
# Terapkan ulang contoh role SQL dari mesin operator.
docker compose run --rm madevi npm run check:ready
# Muat OWNER_USERNAME, OWNER_EMAIL, OWNER_PASSWORD privat untuk bootstrap satu kali.
docker compose run --rm -e OWNER_USERNAME -e OWNER_EMAIL -e OWNER_PASSWORD madevi npm run db:create-owner
```

Pada instalasi Node langsung, perintah ekuivalen adalah `npm run db:migrate`, `npm run check:ready` dan `npm run db:create-owner` dengan environment yang benar. Perintah npm lokal membaca `.env.local` bila tersedia. Untuk file privat server tersendiri, pakai `node --env-file=/lokasi-privat/madevi.env scripts/check-ready.mjs`.

Migrasi menampilkan `Migrasi selesai.` jika skema telah dicatat. `check:ready` menampilkan tujuan host/database tanpa password, status skema, dan status integrasi opsional. Exit 1 berarti ada pengaturan atau probe yang gagal. SMTP kosong dilaporkan belum aktif. SMTP yang terisi diperiksa koneksi/autentikasinya tanpa mengirim email. Google terisi hanya menunjukkan konfigurasi ada. Verifikasi header dan akses origin tetap perlu dilakukan dari jaringan tujuan.

## 5. Jalankan staging, uji fitur, dan putuskan promosi

1. Dari root jalankan `docker compose up -d madevi` dengan opsi lingkungan yang tepat. Pasang Caddy dan periksa DNS, HTTPS serta port aplikasi yang hanya mendengarkan lokal. Pastikan `/api/health/live` dan `/api/health/ready` memberi HTTP 200 dari origin.
2. Masuk ke `/admin` dengan password pemilik, aktifkan TOTP, simpan kode pemulihan secara privat, lalu masuk ulang dengan MFA. Pastikan akun biasa dan sesi admin tanpa MFA ditolak.
3. Dengan SMTP aktif, daftar menggunakan alamat uji, verifikasi, masuk, ganti email, dan coba reset. Coba foto pendaftaran serta laporan. Dengan Google aktif, masuk sebagai pengguna biasa dan konfirmasi penolakan admin pada alur Google. Cocokkan log provider tanpa menyalin token atau isi email.
4. Uji monitoring dan pemulihan dump pada database uji. Gunakan [checklist sebelum dan sesudah online](../ops/deploy-checklist.md). Buka produksi setelah pemilik menyetujui hasil, data dan biaya.

## 6. Siapkan pekerjaan host

1. Siapkan akun proses, Node 24, klien PostgreSQL, database runtime dan direktori privat pada host Compose. Buat environment worker dari contoh. Siapkan timer systemd untuk pesan, operasi dan pemeliharaan sesuai panduan. Biarkan backup rutin dan alarm kosong sampai interval, kunci dan penerima disetujui. [Persiapan dan pemasangan timer](../ops/systemd/README.md)
2. Dari root jalankan `npm run ops:ready` dengan environment host. Periksa kelompok konfigurasi, database, akses backup, mount, katalog dan laporan worker. Cocokkan hasil dengan `systemctl list-timers 'madevi-*'` dan journal karena pemeriksaan aplikasi hanya membuktikan laporan yang sudah diterima.
3. Pada staging, jadwalkan pesan untuk satu akun sintetis satu menit ke depan dan periksa status serta inbox penerima. Ajukan backup dari panel, verifikasi, unduh bila diaktifkan, dan uji restore ke database terpisah. Jalankan retensi dalam mode `dry-run`, simpan salinan backup pada lokasi lain, lalu uji alarm dengan SMTP uji. [Alur admin](operasi-admin.md) dan [pemeriksaan operasi](operasional.md)

## 7. Kenali kegagalan dan pulihkan

- **Konfigurasi kosong atau tidak valid.** Perbaiki variabel yang disebut oleh `check:ready`; restart ketika env runtime berubah. Pastikan namespace env dan origin sesuai lingkungan.
- **Liveness 200, readiness 503.** `schema_pending` berarti skema belum lengkap; periksa checksum dan jalankan migrasi dengan role yang benar. `database_unavailable` berarti periksa jaringan, verifikasi TLS, pool dan izin runtime. Probe tetap tidak menguji layanan email/Google.
- **Email atau OAuth gagal.** Uji koneksi/port dan pengirim email, atau cocokkan redirect URI Google persis. Jika fitur perlu ditutup sementara, kosongkan seluruh kelompok variabelnya. Pertimbangkan dampak pada pengguna yang mengandalkan metode login itu.
- **Rilis perlu dibatalkan.** Hentikan pengalihan trafik. Pakai image lama bila skema kompatibel. Untuk data/skema yang berubah, gunakan perbaikan terkontrol atau restore ke target berbeda, verifikasi, lalu alihkan. [Operasional](operasional.md), [peta pergantian](ganti-layanan.md)
