# Menyiapkan layanan yang akan dipakai

Mulai setelah memilih jalur di [panduan online](online.md#dua-jalur). Semua langkah berikut adalah persiapan yang akan Anda jalankan saat keputusan layanan sudah dibuat. Lingkungan pertama adalah staging, yaitu situs uji terpisah dengan data sintetis. Siapkan akses dashboard penyedia, pengelola secret atau file privat, dan satu catatan lingkungan berisi nama host, wilayah, commit, anggaran, serta siapa yang mempunyai akses. Simpan nilai rahasia di pengelola secret.

## PostgreSQL · wajib

PostgreSQL menyimpan akun, sesi, konten, laporan, notifikasi dan gambar privat. Role database adalah akun dengan hak tertentu, misalnya hak membaca data atau membuat tabel. Beri nama berbeda untuk database lokal, staging dan produksi.

- **Neon.** Di dashboard, pilih proyek dan wilayah yang dekat dengan aplikasi. Buat atau pilih database dan role. Pada **Connect**, cocokkan nama database, role, branch, hostname, dan parameter TLS. TLS melindungi koneksi saat mengirim data. Gunakan alamat koneksi langsung dari penyedia untuk migrasi dan backup, lalu uji konfigurasi runtime dengan `pg`. Simpan connection string lengkap sebagai `DATABASE_URL`. [Koneksi Neon](https://neon.com/docs/connect/connect-from-any-app)
- **DigitalOcean.** Buat cluster PostgreSQL dan Droplet di jaringan privat yang sama bila wilayah dan paket mendukungnya. Di database **Users & Databases**, tentukan database dan role. Di **Settings → Trusted Sources**, beri akses pada server yang membutuhkan koneksi. Pada **Connection Details**, ambil host privat, port, database, role, password dan pengaturan sertifikat TLS. Standard Edition memerlukan CA penyedia untuk verifikasi penuh. CA adalah sertifikat yang dipakai klien untuk mengenali server yang sah. [Koneksi DigitalOcean](https://docs.digitalocean.com/products/databases/postgresql/how-to/connect/), [Trusted Sources](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/)

Bentuk URI secara umum adalah `postgresql://ROLE:PASSWORD_ENCODED@HOST:PORT/NAMA_DB?sslmode=verify-full`. Gunakan nilai dari penyedia dan konfigurasi CA sesuai driver. Untuk CA yang dipasang pada container, contoh path URI adalah `&sslrootcert=/run/madevi-ca/pg-ca.crt`. Mount file tersebut read-only lewat override privat Compose dan gunakan path yang dapat dibaca user non-root. Untuk `psql` dan `pg_dump` di mesin operator, pakai pengaturan CA serta path yang berlaku pada mesin itu.

Hasil yang dicari adalah koneksi TLS yang berhasil dan role yang hanya memiliki hak yang diperlukannya. Dari root repo, jalankan [migrasi dan pemeriksaan](online.md#3-migrasikan-database-tujuan). Bila koneksi habis waktu, cek trusted sources, wilayah, VPC, listener dan port. Jika sertifikat gagal, periksa hostname, CA dan path mount. Jika hak membuat tabel ditolak, pakai role migrasi dan berikan role runtime akses yang dibutuhkan sesudahnya. Pertahankan database lama hingga pemulihan dan pengalihan dibuktikan.

## Host aplikasi dan HTTPS · wajib

Hosting menjalankan proses Next.js. Dockerfile mendefinisikan cara membuat image, yaitu paket aplikasi dan runtime. Container menjalankan image sebagai proses. Compose mengatur port dan konfigurasi container. Pada VPS, Anda mengelola mesin virtual Linux dan sistem operasinya. Pada platform terkelola seperti Render, provider menjalankan image dan dapat mengurus HTTPS. HTTPS adalah HTTP yang dienkripsi dan memakai sertifikat untuk mengenali host.

1. Untuk **Render**, buat rancangan Web Service dari repo dan cabang yang disetujui. Pilih runtime Docker dengan [Dockerfile](../Dockerfile) di root. Siapkan izin akses repo minimum, port yang dipakai layanan, dan health path `/api/health/ready`. Gunakan URL HTTPS bawaan `onrender.com` untuk staging awal. Gunakan pengaturan build/deploy terkontrol agar migrasi siap sebelum health check pertama. [Render Web Service](https://render.com/docs/web-services), [Health checks](https://render.com/docs/health-checks)
2. Untuk **Droplet**, siapkan Linux, autentikasi SSH dengan kunci, pembaruan OS dan Docker Compose. Simpan checkout di direktori milik operator. Batasi SSH, buka port 80/443 untuk proxy, dan pertahankan port aplikasi terikat ke loopback sesuai [compose.yml](../compose.yml). Caddy menerima HTTPS lalu meneruskan request ke aplikasi. Periksa versi Caddy dan contoh batas upload. [Contoh Caddy](../ops/reverse-proxy.example.md)
3. Masukkan runtime env di menu Environment pada Render. Pada VPS, isi `.env.production` privat dari [.env.example](../.env.example) dengan akses baca minimum. Untuk staging terpisah gunakan Compose override privat seperti contoh di [panduan online](online.md#2-isi-environment-dari-sumber-yang-tepat). Simpan secret runtime di luar build args dan Git.
4. Jalankan [migrasi](online.md#3-migrasikan-database-tujuan) dan [aktivasi server](online.md#4-jalankan-aplikasi-dan-periksa-layanan) pada commit yang sama. Uji HTTPS dan health dari browser.
5. Jika build gagal, baca tahap yang gagal di log dan periksa versi Node, akses npm, dan kuota RAM/waktu. Jika health gagal tetapi liveness berhasil, periksa database dan migrasi. Simpan image/stable deploy sebelumnya untuk rollback.

## Domain dan DNS · opsional untuk prototipe

Domain adalah nama yang diketik pengguna. DNS mengarahkan nama itu ke alamat IP server atau ke nama lain. Origin adalah kombinasi skema, host, dan port, misalnya `https://staging.example.invalid`. Aplikasi menggunakan origin untuk sesi, tautan email dan pemeriksaan request.

1. Untuk domain kustom, siapkan akses registrar dan panel DNS, pilih nama khusus staging, lalu tentukan target sesuai host. Subdomain bawaan Render dapat dipakai lebih dulu.
2. Pada Render, tambahkan nama ke **Custom Domains** dan salin record yang diminta. Untuk subdomain umumnya gunakan CNAME menuju target yang ditunjukkan. Tambahkan record verifikasi bila diminta. Pada VPS umumnya buat record A ke IPv4 server, lalu tambahkan AAAA jika server memang melayani IPv6. Hindari record lama untuk nama yang sama bila tujuannya berbeda. [Domain kustom Render](https://render.com/docs/custom-domains)
3. Siapkan HTTPS provider atau Caddy. Samakan `BETTER_AUTH_URL` dengan origin HTTPS yang dipilih dan ubah callback OAuth bila fitur itu dipakai. Sertifikat harus mencakup host tersebut. Jika ada proxy, aktifkan `TRUST_PROXY_HEADERS` hanya setelah origin tidak bisa diakses langsung dan proxy terakhir menimpa `X-Real-IP` dan `X-Madevi-Proxy-Token`. [Konfigurasi Caddy](../ops/reverse-proxy.example.md)
4. Uji DNS dari jaringan lain dan periksa apakah browser menerima sertifikat. Pastikan redirect HTTP → HTTPS hanya pada host yang benar. Bila gagal, periksa record yang berbenturan, waktu cache DNS, firewall 80/443, dan log penerbitan sertifikat. Simpan nilai record, waktu cache atau TTL, serta environment sebelumnya untuk [pemulihan domain](ganti-layanan.md#contoh-mengganti-domain).

## SMTP dan pengirim · wajib jika membuka pendaftaran email

SMTP adalah protokol yang dipakai server untuk menyerahkan email ke provider. Nodemailer memakai email transaksional untuk verifikasi, perubahan alamat dan reset kata sandi. Siapkan akses dashboard email, akses ke alamat/domain pengirim, dan satu alamat penerima uji. Cek apakah host mengizinkan koneksi keluar lewat port yang dipilih.

1. Pada contoh Postmark, pilih server dan **Transactional Message Stream**, aktifkan akses SMTP, buat SMTP Token dan ambil access key serta secret. Verifikasi alamat atau domain pengirim. Bila memakai domain sendiri, ikuti record DNS yang ditampilkan untuk membuktikan kepemilikan dan autentikasi pengirim. [SMTP Postmark](https://postmarkapp.com/developer/user-guide/send-email-with-smtp)
2. Isi kelima nilai pada environment staging. Contoh nama dan sumber nilainya:

   ```dotenv
   SMTP_HOST=smtp.postmarkapp.com
   SMTP_PORT=2525
   SMTP_USER=<ACCESS_KEY_SMTP>
   SMTP_PASS=<SECRET_SMTP>
   MAIL_FROM=no-reply@example.invalid
   ```

   Ganti alamat dengan pengirim yang sudah diverifikasi. Kode memakai TLS langsung untuk port 465 dan mewajibkan STARTTLS pada port lain di staging dan produksi. Pastikan port dan koneksi terenkripsi sesuai pengaturan provider dan host. [Pembatasan Render](https://render.com/articles/can-i-send-email-over-smtp-from-render), [Pembatasan DigitalOcean](https://docs.digitalocean.com/support/why-is-smtp-blocked/)
3. Restart atau rilis ulang sesuai host. Daftar akun uji, lihat status pengiriman provider dan cek inbox, lalu selesaikan verifikasi, perubahan email dan reset. Jika koneksi timeout, periksa port keluar atau limit host. Jika pengiriman ditolak, cocokkan token, izin kirim dan pengirim. Jika terkirim tetapi tautan salah, periksa `BETTER_AUTH_URL`. Jika perlu membatalkan perubahan, pulihkan satu set konfigurasi lama atau kosongkan kelimanya dan restart untuk menutup alur SMTP.

## Google OAuth · opsional

OAuth memungkinkan pengguna memberi izin kepada Google untuk mengonfirmasi identitasnya ke Madevi. Siapkan akses Google Cloud, origin HTTPS yang sudah diketahui, dan akun penguji.

1. Siapkan konfigurasi persetujuan di **Google Auth Platform**, termasuk nama aplikasi, kontak, audiens dan test users untuk staging. Di **Clients**, buat client jenis **Web application**. Masukkan authorized redirect URI `https://staging.example.invalid/api/auth/callback/google` dengan host yang sesungguhnya. Callback adalah alamat tempat Google mengembalikan hasil login. [Google OAuth untuk aplikasi web](https://developers.google.com/identity/protocols/oauth2/web-server)
2. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` dari client tersebut pada environment server. Gunakan client terpisah untuk staging dan production. Restart setelah pasangan dimasukkan.
3. Buka Profil dan coba tombol Google dengan akun pengguna biasa. Akun pengelola memakai password dan MFA. Pastikan alur kembali ke host benar dan lengkapi username/tanggal lahir bila diminta. Coba batal pada layar persetujuan. `redirect_uri_mismatch` berarti skema, host, port atau path berbeda dari allowlist. `access_denied` bisa berarti akun belum masuk daftar penguji atau persetujuan dibatalkan. Bila ingin menonaktifkan integrasi, kosongkan kedua nilai dan restart. Akun yang hanya memakai Google perlu dipertimbangkan sebelum mematikan jalur login.

## Penyimpanan dan monitoring · sesuai tahap

Avatar dan bukti laporan saat ini disimpan dalam PostgreSQL. Folder `public/` hanya untuk aset situs yang boleh diakses siapa saja. Uji unggahan dan akses yang berhak, lalu pastikan gambar ikut dalam latihan backup. Object storage untuk media terpisah membutuhkan perubahan kode dan migrasi. [Peta layanan media](ganti-layanan.md)

Monitoring adalah pemeriksaan berkala yang mengirim alarm saat kondisi memburuk. Untuk operasi, siapkan tujuan notifikasi internal, penanggung jawab dan ambang. Masukkan URL probe di layanan monitoring pilihan, atur polling dan ulang percobaan, lalu uji alarm pada lingkungan sintetis. Periksa pula log error, kuota database dan job backup. [Prosedur operasi](operasional.md)
