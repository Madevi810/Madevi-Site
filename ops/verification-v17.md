# Verifikasi lokal v0.0.0.17

Status **WARNING**. Dasar pekerjaan: v0.0.0.16, commit `11135d934e7109ea9cbd4582127780567eaa20d3` dari Madevi810/Madevi-Site. Pengujian v17 dilakukan secara lokal sebelum push; status CI pada commit terkait perlu diperiksa di GitHub Actions. Tidak ada rilis atau deployment publik. Riwayat keputusan dan laporan lengkap dipelihara terpisah di Pondasi.

## Hasil dan metode

| Pemeriksaan | Lingkungan/metode | Hasil |
| --- | --- | --- |
| Instalasi bersih | Node 24.22.1, npm 11.9.0, `npm ci --no-audit --no-fund` | Lulus |
| Tipe/unit | `npm run typecheck`, `npm test` | Lulus, 17 tes unit |
| Dependensi runtime | `npm audit --omit=dev --audit-level=high` | Tidak ada kerentanan yang dilaporkan pada audit runtime maupun seluruh dependensi; bukan audit seluruh aplikasi |
| Build dan integrasi | PostgreSQL 18 dalam container lokal; flag build/visual/load | Lulus |
| Integrasi default | `npm run test:integration`, PGlite dan SMTP palsu | Lulus; fault injection SQL secara eksplisit hanya pada PostgreSQL |
| Browser | Chromium sistem melalui Playwright, axe; ponsel 320/390, tablet 768, desktop 1440 | Lulus pada skenario yang dijalankan, bukan seluruh perangkat atau aksesibilitas manual |
| Akun/admin | Pendaftaran, email/OTP palsu, sesi, MFA dan kode pemulihan, blokir/pulih, hak akses | Lulus lokal |
| Profil | Password berspasi; kegagalan muat, retry, simpan offline lalu pulih; avatar tambah/ganti/hapus | Lulus browser dan API |
| Integritas | Migrasi kosong/ulang, rollback kosong, penolakan rollback berdata, checksum berubah, konflik revisi/slug | Lulus pada database uji |
| Fault injection SQL | PostgreSQL: audit tidak tersedia, rollback profil/avatar, rate-limit table tidak tersedia lalu dipulihkan | Lulus, data lama bertahan dan API gagal secara terkendali |
| Backup/restore | Skrip backup memakai adaptor pg_dump ke container, pg_restore ke database baru; perbandingan semua baris 19 tabel | Lulus; file 0600, 50.776 byte pada snapshot uji |
| Beban kecil | 30 GET, konkurensi 3, data sintetis | 0 error; p50 28 ms, p95/max 73 ms, total 352 ms pada run akhir PostgreSQL |
| Query lambat | `SELECT pg_sleep(15)` melalui pool aplikasi | Dibatasi sekitar 10.052 ms; query berikutnya berhasil |
| Container | Docker lokal, CA proxy melalui secret BuildKit; aplikasi pada loopback dan PostgreSQL terisolasi | Build/HTTP lulus; stop database: live 200, ready/API 503, start kembali: ready 200; detail koneksi tidak masuk log |
| OAuth tanpa provider | Provider tidak dikonfigurasi, callback tanpa state/code, konfigurasi parsial | Ditolak terkendali; tidak menghasilkan sesi |
| Rahasia/lisensi | Scan pola private key/token/AWS pada file tracked, inspeksi dependensi langsung | Hanya `.env.example` tracked; tidak ditemukan pola rahasia; lisensi langsung teridentifikasi |

## Reproduksi

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run test:integration
```

Untuk PostgreSQL lokal baru dan terisolasi bernama `madevi_ci_*`, atur `MADEVI_TEST_DATABASE_URL` secara privat, lalu:

```sh
MADEVI_TEST_BUILD=1 MADEVI_VISUAL_CHECK=1 MADEVI_TEST_LOAD=1 \
MADEVI_CHROMIUM_PATH=/usr/bin/chromium npm run test:integration
```

Skrip tes memakai port loopback 3000, 25433/25434, database disposable dan SMTP palsu. Jangan menjalankan bersamaan dengan aplikasi lain pada port itu. Flag `MADEVI_CHROMIUM_PATH` bersifat opsional untuk browser sistem. Playwright dan axe sudah menjadi dependensi dev. `scripts/qa-browser.mjs` memperluas pemeriksaan gagal/retry dan navigasi admin; pemanggilnya adalah runner integrasi.

Lingkungan ini memakai proxy HTTPS. Build Docker biasa pertama gagal `SELF_SIGNED_CERT_IN_CHAIN`; build berikut lulus menggunakan CA tepercaya yang dipasang hanya pada langkah instalasi:

```sh
docker build --secret id=proxy_ca,src=/path/ke/ca-tepercaya.pem -t madevi-local .
```

CA bersifat opsional pada Dockerfile. TLS tetap diverifikasi dan CA tidak disalin ke image. Gunakan endpoint Docker dan pengaturan jaringan yang berlaku di mesin Anda.

## Masalah yang diperbaiki

- Endpoint autentikasi umum sebelumnya menerima tanggal lahir tidak valid dan melewati validasi Madevi (direproduksi HTTP 200). Sekarang hanya perubahan nama yang tervalidasi diizinkan melalui endpoint ini, dengan transaksi dan audit; data profil lain tetap melalui API Madevi.
- Formulir publik memangkas spasi password. Sekarang password/konfirmasi dipertahankan persis; identitas dan field non-rahasia tetap dirapikan.
- Form profil/privasi dapat menyimpan default sebelum data berhasil dimuat. Sekarang menunggu data valid, menangani respons lama, menonaktifkan simpan dan menyediakan retry.
- Tujuan sidebar dari profil admin hilang saat berpindah halaman. Sekarang panel dipertahankan melalui query allowlist.
- Konflik slug bersamaan dapat menjadi 503; sekarang unique constraint ditangani sebagai konflik 409.
- Unggah avatar belum diaudit dan semua kegagalan dianggap gambar salah. Audit sekarang berada dalam transaksi; input salah 400 dan kegagalan penyimpanan 503. Rollback profil/avatar diuji dengan kegagalan audit.
- Pool database sebelumnya tidak membatasi waktu query/koneksi dan error koneksi idle dapat masuk log sebagai objek mentah. Sekarang waktu tunggu dibatasi dan error idle dicatat tanpa detail koneksi; tes regresi memeriksa kerahasiaannya.
- Mode Chromium single-process gagal ketika membuat konteks tambahan. Mode itu dihapus. Rate limit antar-skenario sintetis dipisahkan; tes penolakan rate limit tetap dijalankan.

## Batas bukti dan pekerjaan lanjutan

- PGlite wire adapter mengalami korupsi protokol setelah error SQL berparameter (direproduksi terpisah). Fault injection SQL dijalankan hanya pada PostgreSQL asli; runner menyebut pemeriksaan yang tidak dijalankan di PGlite secara eksplisit.
- Firefox dan WebKit dicoba, tetapi unduhannya ditolak HTTP 403 oleh kebijakan domain (`cdn.playwright.dev`, `playwright.download.prss.microsoft.com`). Tidak diklaim lulus. Pembaca layar dan perangkat fisik belum diuji.
- OAuth Google aktif, pengiriman email sungguhan, dan layanan eksternal belum diuji. Callback tanpa provider bukan simulator lengkap Google.
- Codex Security tidak tersedia dalam alat sesi. Pemeriksaan keamanan dilakukan lewat kode, tes negatif, pengujian dependensi dan pola rahasia; bukan pentest atau audit independen.
- Docker pause tidak didukung freezer cgroup lingkungan. Pengujian gangguan memakai stop/start database milik tes; penundaan query diuji terpisah. Tidak meniru setiap jenis putus jaringan.
- Uji beban kecil bukan bukti kapasitas besar. Batas query 10 detik perlu dievaluasi kembali bila pekerjaan database menjadi besar.
- Masih perlu perluasan pengujian pemulihan akun melalui UI, kondisi gagal di panel lain, aksesibilitas manual, dan keseragaman error pada seluruh API. Halaman baca dan beberapa API lain masih mengandalkan error boundary/proxy pada kegagalan dependensi.
- Lisensi aplikasi sendiri belum ditentukan; lisensi font/dependensi tidak otomatis menentukan lisensi Madevi.

Aplikasi mendukung pengembangan lokal lanjutan. Bukti ini belum cukup untuk menyatakan prototipe online atau produksi siap. Konfigurasi provider, pengujian lingkungan tujuan, kebijakan final dan audit tetap merupakan pekerjaan terpisah.
