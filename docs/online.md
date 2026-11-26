# Pilihan tambahan untuk menjalankan Madevi online

Untuk jalur utama Compose, PostgreSQL dan Caddy, gunakan [aktivasi default](aktivasi-default.md). Contoh berikut membandingkan opsi penyedia.

Mulai dari staging, yaitu situs uji terpisah dengan data sintetis dan akses terbatas. Lingkungan development berjalan di komputer, staging memakai origin HTTPS dan konfigurasi sendiri, sedangkan production dipakai pengguna nyata setelah pemeriksaan lulus. Siapkan database, origin, akun, dan secret berbeda untuk setiap lingkungan. [Mode lingkungan](../ops/environments.md), [jalankan lokal](lokal.md)

Saat ini pemilik belum menyediakan hosting/VPS, deployment, domain, database online, SMTP, akses Google OAuth, penyimpanan cloud, atau monitoring. Git dan lingkungan pengembangan tersedia. [Bukti pengujian lokal](laporan-lanjutan.md)

| Bagian | Yang tersedia di repo dan diuji lokal | Yang masih diperlukan untuk uji online |
| --- | --- | --- |
| Hosting, domain, HTTPS | Dockerfile, Compose, contoh Caddy, probe, dan workflow pengujian. Server lokal dapat dijalankan. | Pilih host, origin dan TLS. Buat konfigurasi runtime serta uji rilis dan batas host tujuan. |
| PostgreSQL | Pool, migrasi dan backup. Integrasi PostgreSQL lokal dan pemulihan dump pernah diuji. | Database terpisah, URI/CA, jaringan, role, backup dan uji restore provider. |
| Email dan Google | Nodemailer/Better Auth, konfigurasi opsional, dan endpoint callback. SMTP palsu serta keadaan Google tanpa konfigurasi pernah diuji lokal. | Kredensial dan uji transaksi email nyata/consent Google jika fitur dibuka. |
| Media dan monitoring | Gambar privat disimpan di DB. Probe dan log tersedia. | Uji upload/restore pada hosting. Pasang pemantauan; penyimpanan cloud dipertimbangkan jika ada kebutuhan media di luar DB. |

Saat pengguna membuka domain, DNS mengarahkan browser ke host. HTTPS melindungi sambungan ke server atau proxy. Next.js menerima request, memakai PostgreSQL untuk akun, konten, dan gambar privat, lalu menghubungi SMTP untuk pengiriman email dan Google untuk login sosial jika dikonfigurasi. Aplikasi dan DB bisa dari penyedia yang sama atau terpisah. Email dan Google dapat ditambahkan setelah situs dasar berjalan.

## Yang perlu disediakan

| Kapan | Kebutuhan |
| --- | --- |
| Wajib untuk menjalankan aplikasi online | Host Node.js 24 atau container yang menerima request HTTP, PostgreSQL yang dapat dijangkau secara aman, origin HTTPS, secret autentikasi, dan migrasi. Subdomain HTTPS provider dapat dipakai untuk prototipe. |
| Wajib untuk mengelola aplikasi | Kredensial sementara untuk admin awal, perangkat autentikator, tempat penyimpanan kode pemulihan, dan prosedur pemulihan yang diuji. |
| Wajib saat membuka pendaftaran email | SMTP transaksional dan pengirim terverifikasi untuk verifikasi pendaftaran, perubahan alamat, serta reset kata sandi. |
| Wajib untuk operasi jangka panjang | Domain/origin stabil, jaringan dan edge terkelola, monitoring, backup terenkripsi di lokasi terpisah, retensi, uji restore, proses rilis/rollback dan penanggung jawab. |
| Opsional | Domain kustom untuk prototipe, Google OAuth dan pilihan layanan email bila pendaftaran belum dibuka. |
| Dibutuhkan nanti | Object storage/CDN dan video untuk media berskala besar, cache/antrean sesuai hasil pengukuran, realtime untuk Line, dan integrasi mitra. Saat ini avatar dan bukti laporan disimpan di PostgreSQL. |

## Dua jalur

Harga dan batas di bawah diperiksa pada **25 November 2026**. Harga USD, paket dan kapasitas dapat berubah. Pastikan lagi wilayah, kuota data keluar dan build, biaya tambahan, syarat persetujuan email dan harga domain di dashboard sebelum memilih. Catat biaya awal, biaya bulanan, batas anggaran, ambang alarm dan siapa yang membayar. CU-jam adalah satuan pemakaian kapasitas komputasi database.

| Aspek | Prototipe hemat · Render Free + Neon Free | Pengoperasian jangka panjang · DigitalOcean Droplet + PostgreSQL terkelola |
| --- | --- | --- |
| Kegunaan dan kesulitan | Demo staging dengan data sintetis. Kesulitan rendah. TLS dan runtime dikelola provider. | Server aplikasi stabil, pemisahan lingkungan dan kendali firewall/proxy. Kesulitan menengah. |
| Kesesuaian stack | Render Web Service dengan Dockerfile dan HTTPS. Neon memakai PostgreSQL dan URI TLS. Uji image, cold start, koneksi dan CPU/RAM pada paket pilihan. | Docker/Compose dan Caddy di VPS, database PostgreSQL lewat jaringan privat dan TLS. Ukur kebutuhan RAM build di runner, ruang dan kapasitas aplikasi. |
| Batas layanan | Render berhenti setelah 15 menit tanpa request dan memberi 750 jam gratis per workspace per bulan. Neon Free mencantumkan 1 GB penyimpanan dan 100 CU-jam per proyek per bulan, sampai batas penyimpanan total akun. Port SMTP 25, 465 dan 587 diblokir pada Render Free. | Contoh Droplet Basic 2 GiB RAM, satu vCPU, disk 50 GiB dan transfer 2.000 GiB yang tercantum. PostgreSQL single-node tanpa ketersediaan tinggi. Port SMTP 25, 465 dan 587 juga diblokir di Droplet. |
| Perkiraan biaya | US$0 pada kuota gratis dan subdomain provider. Postmark Free mencantumkan 100 email/bulan tanpa tambahan pemakaian jika akses kirim disetujui. Pantau penggunaan dan periksa ketentuan terkini. | Droplet contoh US$12/bulan + PostgreSQL single-node dari US$15/bulan, kisaran awal **US$27/bulan** untuk satu lingkungan. Anggaran terpisah untuk staging, domain, email, backup di lokasi lain, traffic tambahan, pajak, atau database dengan ketersediaan tinggi. Sebagai contoh tambahan opsional, Postmark Basic mencantumkan US$15/bulan pada 10.000 email. |
| Kebutuhan pengelolaan | Simpan secret, atur akses staging, jalankan migrasi sebagai langkah terkontrol, pantau kuota dan uji pemulihan. | Kelola patch OS, firewall, sertifikat dan Caddy, image, SSH, monitoring dan jadwal backup. Provider mengelola mesin database sesuai paketnya. |
| Kemudahan pindah | Gunakan Dockerfile dan dump PostgreSQL. Ganti origin, aturan jaringan, secret, callback dan DNS setelah menguji pemulihan. | Image dan dump PostgreSQL juga portabel. Pindahkan konfigurasi proxy, alert, penyimpanan backup dan aturan akses secara terpisah. |
| Sumber resmi | [Render Free](https://render.com/docs/free), [Render Web Services](https://render.com/docs/web-services), [kuota Neon Free](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Postmark](https://postmarkapp.com/pricing) | [Droplet](https://www.digitalocean.com/pricing/droplets), [harga PostgreSQL](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/), [pembatasan SMTP](https://docs.digitalocean.com/support/why-is-smtp-blocked/) |

## 1. Siapkan akses dan layanan

Gunakan [langkah setiap layanan](siapkan-layanan.md) untuk menyiapkan dashboard, URI, TLS, DNS, pengirim SMTP, dan callback Google. Pilih serta catat layanan dahulu sebelum mengisi environment.

- Pilih commit yang akan diuji, akses GitHub, lingkungan, wilayah aplikasi dan DB, orang yang memegang akses, serta batas biaya. Siapkan akses staging untuk penguji yang ditunjuk. Jika host prototipe belum membatasi akses, gunakan data dan identitas uji saja.
- **Render + Neon** — siapkan Neon project dan role untuk database staging, ambil koneksi direct/TLS dari dialog Connect untuk migrasi, lalu siapkan Render Web Service dengan runtime Docker dan repo ini sebagai root. Gunakan origin `onrender.com` yang diberikan. Kendalikan waktu aktivasi/auto-deploy dan pastikan migrasi selesai sebelum menyatakan layanan siap. Jika origin baru terlihat setelah Web Service dibuat, deploy pertama dapat gagal readiness. Catat origin yang diberikan, isi environment, jalankan migrasi, lalu ulangi deploy secara manual.
- **DigitalOcean** — siapkan Droplet Linux dengan Docker Compose, firewall, SSH terbatas dan PostgreSQL terkelola. Gunakan private hostname dalam VPC dan trusted sources. Untuk Standard Edition, pasang CA provider di lokasi privat yang dapat dibaca container dan gunakan `sslmode=verify-full` serta opsi `sslrootcert` dengan path yang sesuai. Tambah mount read-only pada override Compose privat. Untuk alat backup/libpq ikuti opsi CA provider pada mesin yang menjalankan alat. Arahkan DNS domain ke VPS dan siapkan sertifikat HTTPS melalui Caddy. Biarkan app port terikat ke loopback sesuai konfigurasi Compose. [Koneksi DigitalOcean](https://docs.digitalocean.com/products/databases/postgresql/how-to/connect/), [Compose](../compose.yml), [contoh proxy](../ops/reverse-proxy.example.md)

## 2. Isi environment dari sumber yang tepat

| Nama | Sumber dan nilai |
| --- | --- |
| `DATABASE_URL` | URI PostgreSQL dari dashboard penyedia. Gunakan `postgresql://` dengan TLS dan pengaturan verifikasi yang berlaku, serta kredensial database tujuan. Untuk migrasi/backup gunakan direct connection yang berhak. Runtime memakai role minimum yang telah diuji. |
| `BETTER_AUTH_URL` | Origin HTTPS dari Render atau domain yang telah dipasang. Isi skema dan host persis, tanpa path, query maupun kredensial. |
| `BETTER_AUTH_SECRET` | Buat nilai acak minimal 32 karakter untuk setiap lingkungan dan simpan di secret manager. Mengubahnya memerlukan peninjauan dampak sesi. |
| `MADEVI_ENV`, `MADEVI_DEMO_MODE` | Isi `staging` atau `production`, dan selalu `false` untuk demo. Compose utama mengatur mode production. Untuk staging di VPS gunakan konfigurasi Compose privat yang mengganti mode dan memakai env file staging. |
| `MEDIA_BACKEND`, `TRUST_PROXY_HEADERS` | Gunakan `postgres`. Untuk proxy default, aktifkan trust setelah origin tertutup dan proxy menimpa IP serta token berbasis `MADEVI_PROXY_SECRET`. [Contoh proxy](../ops/reverse-proxy.example.md) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Isi kelimanya dari pengaturan provider. Contoh Postmark transaksional memakai `smtp.postmarkapp.com` dan port `2525`, access key dan secret dari SMTP Token, serta pengirim/domain terverifikasi. Aktifkan akses SMTP di provider dan uji STARTTLS/delivery dari host. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Buat OAuth client jenis Web application dan konfigurasi consent/test user di Google Cloud. Masukkan redirect URI persis `https://<host>/api/auth/callback/google`. Isi kedua nilai bila digunakan. |
| `OWNER_USERNAME`, `OWNER_EMAIL`, `OWNER_PASSWORD` | Identitas pemilik pertama dan kata sandi unik minimal 12 karakter. Sediakan hanya pada proses bootstrap dan hapus dari environment proses sesudahnya. |

Gunakan [.env.example](../.env.example) sebagai daftar variabel. Isi secret melalui dashboard Render atau environment privat pada VPS. Compose utama membaca `.env.production`. Jika SMTP atau OAuth ditunda, biarkan seluruh kelompok variabelnya kosong. Batasi nilai rahasia pada server dan jangan masukkan melalui Docker build args, Git atau log. [Secret Render](https://render.com/docs/configure-environment-variables), [SMTP Postmark](https://postmarkapp.com/developer/user-guide/send-email-with-smtp), [SMTP Render](https://render.com/articles/can-i-send-email-over-smtp-from-render), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)

**Contoh staging.** Pakai format ini di pengaturan Environment host atau di `.env.staging` privat. Ganti semua placeholder sebelum digunakan.

```dotenv
MADEVI_ENV=staging
MADEVI_DEMO_MODE=false
BETTER_AUTH_URL=https://staging.example.invalid
BETTER_AUTH_SECRET=<SECRET_ACAK_KHUSUS_STAGING>
DATABASE_URL=<URI_DATABASE_STAGING_DARI_PROVIDER>
MEDIA_BACKEND=postgres
TRUST_PROXY_HEADERS=false
```

Untuk Compose di VPS, `compose.yml` normal mengatur `MADEVI_ENV=production`. Untuk staging buat override privat, misalnya `/lokasi-privat/madevi-staging.yml`, dengan Docker Compose 2.24.4 atau lebih baru. `!override` mengganti daftar bawaan, sehingga hanya `.env.staging` yang dibaca. Env file relatif terhadap root repo, lokasi file Compose pertama.

```yaml
services:
  madevi:
    env_file: !override
      - .env.staging
    environment:
      MADEVI_ENV: staging
    ports: !override
      - '127.0.0.1:3100:3000'
```

Dari root, bentuk perintah staging adalah `docker compose -p madevi-staging -f compose.yml -f /lokasi-privat/madevi-staging.yml config --quiet`. Gunakan awalan opsi yang sama untuk `build`, `run`, dan `up`. Arahkan proxy staging ke port host 3100. Jaga file override dan env privat agar tidak masuk Git. Produksi memakai `.env.production` dan port Compose bawaan. [Penggabungan Compose](https://docs.docker.com/reference/compose-file/merge/)

## 3. Migrasikan database tujuan

Jalankan perintah berikut dari root checkout yang berisi `package.json` dan `compose.yml`.

1. Pastikan commit, lingkungan dan database benar. Untuk database yang sudah berisi data, ambil backup dan uji kompatibilitas aplikasi lama/baru sebelum perubahan skema.
2. Pada Render/Neon, pakai checkout commit yang sama dan Node 24 pada mesin yang diberi akses DB. Setelah `npm ci`, simpan nilai staging dan URI role migrasi dalam file privat di luar repo, misalnya `/lokasi-privat/madevi-staging.env`. Jalankan `node --env-file=/lokasi-privat/madevi-staging.env scripts/migrate.mjs`. Berbeda dengan file Compose, file ini harus diberikan melalui flag tersebut. Pakai terminal tanpa nilai database/origin lain yang sudah diekspor, karena nilai tereskpor mendapat prioritas.
3. Pada VPS dengan konfigurasi production Compose, siapkan image dengan `docker compose build madevi`. Jalankan `docker compose run --rm madevi npm run db:migrate` dengan kredensial migrasi tersedia melalui mekanisme env privat untuk job satu kali. Jika kredensial dipisah, muat URI role migrasi ke environment shell privat dan jalankan job dengan `docker compose run --rm -e DATABASE_URL madevi npm run db:migrate`. Env file aplikasi tetap memakai role runtime. Uji akses role runtime setelah migrasi.
4. Pastikan runner sukses serta semua versi pada daftar migrasi tercatat. Jangan menulis ulang SQL yang checksum-nya sudah tersimpan. CI punya uji rollback di database sintetis. Untuk lingkungan berdata, pilih migrasi perbaikan atau pemulihan yang ditinjau. [Panduan database](../database/README.md)

## 4. Jalankan aplikasi dan periksa layanan

Gunakan [checklist sebelum online](../ops/deploy-checklist.md#sebelum-online) sebelum menjalankan deployment. Gunakan alur ini saat Anda sudah memilih host dan menyetujui aktivasi.

1. Render menjalankan `npm start` dari image. Di VPS start dengan `docker compose up -d madevi` sesudah migrasi dan siapkan Caddy/TLS. Untuk build manual tanpa container, `npm run build` lalu `npm start` memakai konfigurasi valid dengan mode staging/production dan origin HTTPS. Placeholder pada Dockerfile hanya digunakan ketika build.
2. Pastikan `/api/health/live` dan `/api/health/ready` memberi 200 pada origin HTTPS. Readiness menguji koneksi, skema migrasi dan bukti MFA. Setel health path web service ke `/api/health/ready`. Periksa redirect HTTPS, host/origin, cookie sesi dan akses origin.
3. Di staging, periksa header dan pembatasan upload. Amati log tanpa password, token, URI database maupun isi pesan privat. Konfigurasikan alarm untuk kesiapan, HTTP 5xx, koneksi DB, penyimpanan dan kegagalan backup. Tetapkan penerima, ambang, retensi, dan anggaran. Workflow GitHub saat ini memverifikasi kode dan database uji. Sambungkan deployment terkontrol setelah staging lulus serta pisahkan hak CI dari kredensial produksi. [Health check Render](https://render.com/docs/health-checks), [panduan operasi](../ops/operations.md)

## 5. Buat admin dan uji alur

1. Dengan koneksi database tujuan dan ketiga nilai `OWNER_*` hanya pada proses bootstrap, jalankan `npm run db:create-owner`. Untuk environment di file privat terpisah, jalankan `node --env-file=/lokasi-privat/madevi-owner.env scripts/create-owner.mjs` dengan `DATABASE_URL` dan `OWNER_*` di file itu. Hapus nilai bootstrap setelah dipakai. Pada VPS proses ekuivalen ialah `docker compose run --rm -e OWNER_USERNAME -e OWNER_EMAIL -e OWNER_PASSWORD madevi npm run db:create-owner`, dengan nilai dimuat melalui shell privat. Skrip menolak pembuatan jika admin sudah ada.
2. Masuk sebagai pemilik melalui `/admin`, aktifkan autentikator dan verifikasi kode. Simpan kode pemulihan secara aman. Uji keluar/masuk kembali, pemulihan dengan kode sekali pakai, dan penolakan akses admin dari akun biasa.
3. Jika SMTP aktif, daftar dengan alamat uji, cek email verifikasi, login, pergantian email, dan OTP reset. Periksa delivery dan kuota di provider. Jika Google aktif, uji callback/consent, sesi, kelengkapan username/tanggal lahir dan pembatalan consent. Untuk kelompok variabel yang ditunda, cek perilakunya saat tidak dikonfigurasi.
4. Uji avatar tambah/ganti/hapus, laporan dengan gambar uji dan pembatasan akses gambar. Uji pembuatan draf, peninjauan, terbit, pencarian dan baca. Ikuti [checklist](../ops/deploy-checklist.md) untuk menilai kapan data nyata boleh digunakan.

## 6. Backup dan rollback

1. Siapkan `pg_dump` yang kompatibel, akses aman DB dan lokasi dengan izin privat di luar repo. Jalankan `npm run db:backup -- /direktori-privat/madevi.dump` dari host/job operasi yang memiliki alat PostgreSQL. Image runtime saat ini tidak memasang `pg_dump`.
2. Enkripsi hasil, simpan salinan terpisah dan jalankan restore ke database baru yang kosong. Bandingkan versi checksum, record, media tersimpan, login dan hasil health check. Tetapkan jadwal, retensi, akses dan sasaran pemulihan. Jika media kelak dipindahkan, buat backup dan uji pemulihan media bersama database. [Backup dan restore](../ops/backup-restore.md)
3. Setelah online, ikuti [checklist sesudah online](../ops/deploy-checklist.md#sesudah-online). Untuk jadwal pemeliharaan dan pindah penyedia, gunakan [panduan operasional](operasional.md).
4. Jika rilis gagal, hentikan promosi, simpan log yang relevan, lalu pasang kembali image/commit yang sebelumnya lulus setelah memastikan kompatibilitas skema. Untuk perubahan data atau skema, uji perbaikan atau restore di tujuan terpisah sebelum pengalihan. Prosedur rollback aplikasi dan pemulihan database perlu dilatih pada staging. [Rollback Render](https://render.com/docs/rollbacks), [respons insiden](../ops/incident-response.md)
