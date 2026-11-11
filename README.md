# MADEVI — project website v0.0.0.15

Website pendidikan dan jasa digital dengan tujuh ruang. Ini adalah **implementasi awal untuk pengujian**, belum dinyatakan siap untuk produksi atau data pengguna nyata. Tujuh ruang dan taksonominya sengaja belum diisi.

Notifikasi umum, sistem, dan sosial dimuat per kelompok dengan halaman lanjutan; notifikasi pribadi memerlukan sesi yang berhak. Navigasi keyboard dan umpan balik form ditingkatkan.

## Persiapan

Diperlukan Node.js 24 LTS atau versi LTS yang kompatibel, npm, dan PostgreSQL yang dapat diakses. Siapkan database khusus untuk pengujian, terpisah dari produksi. Jangan menjalankan akun demo di sistem dengan data nyata.

1. Jalankan `npm ci` di direktori ini.
2. Salin `.env.example` ke `.env.local`, isi `DATABASE_URL`, `BETTER_AUTH_URL`, dan `BETTER_AUTH_SECRET` acak minimal 32 karakter. Simpan file tersebut secara pribadi. Nilai default pada contoh bukan kredensial aktif.
3. Jalankan `npm run db:migrate`.
4. Untuk dua akun demo **hanya di lingkungan development yang tidak dibuka publik**, atur `MADEVI_ENV=dev`, `MADEVI_DEMO_MODE=true`, dan `DEMO_PASSWORD` melalui `.env.local`, lalu jalankan `npm run db:seed-demo`. Username: `Madevi-Admin` dan `Madevi-User`. Password tidak disertakan dalam kode atau arsip. Akun demo menggunakan verifikasi yang telah ditandai selesai dan tidak memerlukan MFA. Batasi siapa yang dapat mengakses lingkungan uji.
5. Jalankan `npm run dev`, kemudian buka alamat yang ditampilkan terminal. Demo dinonaktifkan dalam `NODE_ENV=production`; akun demo tetap ditolak meskipun ada di database. Jangan memasukkan atau memindahkan akun demo ke produksi.

## Akun biasa dan admin non-demo

- Pendaftaran pengguna biasa membutuhkan SMTP: isi semua `SMTP_*` dan `MAIL_FROM`. Tanpa konfigurasi tersebut pendaftaran ditolak, agar akun tidak tampak terverifikasi padahal email tidak dikirim.
- Google OAuth menggunakan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`; daftarkan URL callback `/api/auth/callback/google` pada penyedia dan konfigurasi asal yang sesuai. Alur ini belum diuji dengan akun Google sungguhan. Setelah masuk, pengguna yang belum memiliki username diminta melengkapi username dan tanggal lahir.
- Nomor telepon dapat disimpan pada pendaftaran, tetapi **login melalui nomor telepon belum tersedia**. Verifikasi kepemilikan nomor dan layanan pendukung harus dirancang sebelum diaktifkan.
- Untuk membuat admin non-demo pertama, isi `OWNER_USERNAME`, `OWNER_EMAIL`, dan `OWNER_PASSWORD` secara aman, lalu jalankan `npm run db:create-owner`. Skrip menolak jika sudah ada admin. Hapus nilai password dari file konfigurasi setelah digunakan. Saat pertama masuk `/admin`, aktifkan autentikator, catat kode pemulihan, dan verifikasi kode. Dashboard dan API admin menolak akun admin non-demo yang belum mengaktifkan autentikator. Tinjau dan uji seluruh jalur pemulihan serta konfigurasi sebelum penggunaan nyata.
- `BETTER_AUTH_URL` harus URL HTTPS untuk `MADEVI_ENV=production`. Pastikan reverse proxy, TLS, cookies, batas request dan asal permintaan dikonfigurasi serta diuji sesuai deployment.

## Status fungsi

- Tersedia: halaman beranda dan ruang kosong; pencarian judul untuk konten terbit; sidebar; tema; sebagian terjemahan; login/daftar dengan verifikasi email ketika SMTP dikonfigurasi; sesi; perubahan nama; unggah foto profil JPG/PNG/WebP hingga 1 MB, diproses ulang dan disimpan privat di database; laporan masalah; admin dengan daftar, blokir/pulihkan pengguna dan laporan; audit aksi blokir; autentikator dan kode pemulihan admin.
- Panel admin memiliki pengelolaan draf dan penerbitan teks dasar dengan halaman hasil; daftar akun dan laporan juga menggunakan halaman hasil. Ini belum menjadi pengelola seluruh fitur tujuh ruang. Google OAuth telah disiapkan secara kondisional, tetapi belum diuji dengan penyedia asli. Login nomor telepon, tautan akun sosial developer, notifikasi sosial, serta daftar simpan/belajar/katalog/riwayat belum terhubung. Notifikasi umum dan sistem sudah memakai database dan diuji lokal; belum diuji dengan layanan nyata. Panel dan data School, Shop, Tools, Services, dan Line belum dibangun.
- Pengaturan bahasa belum mencakup semua teks admin; navigasi admin dan aksesibilitas memerlukan pengujian perangkat lebih luas. Pembatasan permintaan memakai bucket bersama secara bawaan; header IP hanya dipakai setelah proxy tepercaya dikonfigurasi seperti dijelaskan di bawah.
- Belum ada layanan monitoring, layanan penyimpanan media skala besar, backup terjadwal, provider hosting, audit keamanan independen, atau pengujian kapasitas produksi. Pendaftaran dan OAuth memerlukan provider yang belum disiapkan. Jangan menyatakan aplikasi siap produksi.

## Pengujian

`npm test` menguji aturan isolasi demo dan konfigurasi email. `npm run typecheck` memeriksa TypeScript. `npm run test:integration` membuat database PostgreSQL **PGlite sementara di memori** dan server SMTP lokal palsu untuk pengujian; tes ini tidak menggantikan uji PostgreSQL server sungguhan, SMTP asli, atau Google OAuth. Ia menguji migrasi, dua akun demo, verifikasi email uji, kontrol akses admin, pemblokiran/pemulihan, sesi, nama pengguna tetap, foto, laporan dan MFA. Tes menggunakan port lokal 25433, 25434, 3000 dan data sementara.

`npm run build` membangun aplikasi; konfigurasi database dan rahasia tetap diperlukan saat membangun dan menjalankan. Karena build memakai `NODE_ENV=production`, wajib mengatur `MADEVI_ENV=staging` atau `production` dan `BETTER_AUTH_URL` HTTPS; jangan menggunakan mode demo. Konfigurasi development lokal `MADEVI_ENV=dev` hanya untuk menjalankan `npm run dev`. Untuk pemeriksaan visual otomatis opsional, pasang browser Playwright yang sesuai lalu gunakan `MADEVI_VISUAL_CHECK=1 npm run test:integration`.

Untuk backup manual, pasang `pg_dump` yang cocok dan jalankan `npm run db:backup -- /lokasi-aman/madevi.dump`. Backup harus dilindungi dan diuji dengan pemulihan ke database **uji terpisah**. Otomasi backup, enkripsi, retensi dan uji pemulihan backup logis belum disiapkan. Pemulihan salinan fisik lokal sudah diuji.

## Keamanan dan lisensi

Perangkat lunak dan dependensi perlu ditinjau serta diperbarui sebelum penggunaan nyata. Jangan memasukkan rahasia ke repositori, log, tangkapan layar, atau arsip. Kode ini belum diaudit independen. Noto Sans disertakan dengan lisensi SIL OFL di `public/fonts/OFL-Noto-Sans.txt`; lisensi dependensi tercatat pada paket masing-masing.


## Pembaruan sistem v0.0.0.2

Pondasi generik disiapkan dalam keadaan kosong: dokumen memiliki ruang, tipe, slug unik, metadata, relasi, riwayat revisi, dan alur `draft → in_review → approved → published` serta arsip. Revisi yang sudah terbit tetap terlihat sampai revisi baru diterbitkan. API publik hanya membaca versi terbit; operasi admin dibatasi izin, input divalidasi, daftar mempunyai pagination, filter, dan pengurutan yang dibatasi. Hak `author`, `reviewer`, dan `moderator` tersedia sebagai kerangka, tetapi tidak ada staf tambahan yang dibuat; Ade tetap satu-satunya admin. Tabel akun dan data aplikasi menggunakan satu pool dalam proses aplikasi.

Media memakai kontrak penyimpanan; implementasi saat ini tetap PostgreSQL dengan varian avatar WebP 64/256/512 dan dukungan avatar lama. Pencarian memakai adaptor PostgreSQL; cache bawaan tidak menyimpan data. Belum ada object storage, CDN, cache bersama atau pencarian eksternal aktif. Mengganti penyedia masih memerlukan adaptor dan pengujian.

Validasi lingkungan, CSP nonce, HSTS untuk produksi, rate limit bersama PostgreSQL, log keamanan terstruktur, health live/ready dan contoh CI/container telah ditambahkan. Jangan mengaktifkan `TRUST_PROXY_HEADERS` kecuali reverse proxy yang terpercaya menghapus header dari klien dan mengisi `X-Real-IP`; secara bawaan semua permintaan tanpa identitas proxy memakai satu bucket bersama. Lihat `ops/environments.md` dan `ops/operations.md`. Rate limit di database adalah perlindungan awal, bukan mitigasi DDoS skala besar. Pengumpulan log, monitoring dan alert pihak ketiga belum tersambung.

Untuk uji lokal: `npm run typecheck`, `npm test`, dan `npm run test:integration`. Pengujian integrasi memakai database sementara PGlite; dengan `MADEVI_TEST_DATABASE_URL` dapat memakai PostgreSQL lokal dengan nama database `madevi_ci_*` yang terisolasi. `scripts/test-real-postgres.mjs` dapat menguji PostgreSQL lokal terisolasi dan pemulihan salinan fisik saat server berhenti, dengan `MADEVI_POSTGRES_BIN_DIR` menunjuk binari `initdb` dan `pg_ctl`. Skrip tersebut membuat dan menghapus cluster sementara miliknya sendiri. Dockerfile dan CI tersedia, tetapi belum diuji lewat Docker/GitHub Actions di lingkungan ini. Backup otomatis dan restore dengan `pg_dump`/`pg_restore` masih memerlukan uji pada lingkungan tujuan. Detail hasil dan batas pengujian disimpan bersama dokumen Pondasi yang terpisah.


## Penyiapan server v0.0.0.3

Folder ini dapat menjadi akar repository Git dan berdiri sendiri dari dokumen Pondasi. `compose.yml` dan `ops/reverse-proxy.example.md` adalah contoh untuk disesuaikan setelah provider, database dan domain tersedia; belum diuji di Docker atau server tujuan. Database dan kredensial tidak disertakan. Ikuti `ops/deploy-checklist.md` sebelum menerima data nyata. Folder `database/` menjelaskan migrasi tanpa menyalin berkasnya.

Tailwind dan PostCSS telah dipasang sebagai dasar, tanpa preflight untuk menjaga tampilan saat ini. Token warna lama tetap dipakai. Migrasi sebagian besar class CSS ke utility Tailwind dan pemeriksaan semua layar belum selesai; jangan menganggap seluruh styling sudah dimigrasikan.


## Status v0.0.0.11

WARNING / belum siap pengguna nyata. Pengamanan mode runtime dan validasi data admin diperketat; daftar akun, laporan, serta konten mendukung halaman hasil dan notifikasi admin mengambil status nyata. Gaya komponen global dipindahkan ke utility, tetapi pemeriksaan visual masih belum lulus. Site online tidak diperbarui.

## Riwayat v0.0.0.10

WARNING / belum siap pengguna nyata. Cabang tampilan audit telah dipisahkan dari aplikasi; demo lokal terbatas tetap ada. Migrasi sebagian CSS dilakukan, namun audit visual dan Tailwind belum lengkap. Tidak ada perubahan pada site online.

## Riwayat v0.0.0.9

WARNING / belum siap pengguna nyata. Akun demo sementara dibatasi untuk development lokal; lihat `ops/demo-terbatas.md`. Kebutuhan layanan dicatat di `ops/kebutuhan-layanan.md`. Bahan site audit tidak ada dalam paket; sejumlah cabang audit lama dalam komponen masih perlu dipisahkan.

## Riwayat v0.0.0.8

Situs audit menggunakan data contoh di browser; database, SMTP dan backend nyata belum terhubung. Migrasi 002 menambah notifikasi, laporan dan preferensi sosial, serta perlu dijalankan bersama migrasi lain sebelum menjalankan backend baru. OTP dan pemisahan hak akses diuji lokal dengan data sintetis; SMTP/Google nyata, staging, CI, Docker, backup di lingkungan tujuan dan audit independen masih belum lulus. Halaman kebijakan belum final. Belum siap pengguna nyata.

## Status historis v0.0.0.7

Tautan audit privat menyediakan tampilan User dan Admin uji sementara tanpa akses server/database. Pendaftaran asli dirancang dua langkah dan masih memerlukan PostgreSQL serta email verifikasi nyata. Jangan memasukkan data sungguhan pada tautan audit. Bahan site audit dipisahkan dari paket aplikasi v0.0.0.9. Sistem belum siap produksi.

## Status historis v0.0.0.6

Tampilan audit memakai komponen source Madevi yang sama, tetapi akun, laporan, database, dan API belum terhubung. Bahan site audit dipisahkan dari paket aplikasi v0.0.0.9. Ini bukan staging aplikasi penuh dan bukan kesiapan produksi. Build dan deploy ulang diperlukan setiap perubahan source.

## Status historis v0.0.0.5

Migrasi gaya komponen ke Tailwind serta struktur rujukan database dan prosedur backup telah diselesaikan dalam lingkup lokal. Typecheck dan tujuh tes unit lulus; integrasi, build, browser Chromium dengan data sintetis dan aksesibilitas terbatas dicatat di `Pondasi/Foundation/12-Handover/Verification-Stage-4.md`. Folder Pondasi tidak menjadi dependensi aplikasi. CI GitHub, Docker, backup logis di tujuan, staging, audit, dan produksi belum terbukti. Database akan dibuat baru; penyedia layanan belum dipilih. Tidak siap pengguna nyata.

## Status historis v0.0.0.4

Pencarian dan halaman baca hanya menampilkan versi terbit; halaman baca saat ini mendukung blok paragraf teks sederhana, bukan semua format materi. Admin dapat mengelola draf teks sederhana; editor menolak format yang belum didukung agar data tidak terhapus. Seluruh ruang tetap tidak berisi data nyata.

Migrasi Tailwind masih berlangsung; jangan menyatakan seluruh komponen sudah selesai. Pengaman rollback uji menolak jika ada data pada tabel Madevi atau auth yang dikenal, namun tetap hanya untuk development dan tidak boleh dipakai sebagai pemulihan produksi. Pemulihan password telah diuji dengan SMTP palsu, bukan penyedia nyata. CI, Docker, staging, dan kesiapan produksi belum teruji.
