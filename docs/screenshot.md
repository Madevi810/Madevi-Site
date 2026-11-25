# Memperbarui screenshot README

Galeri merekam aplikasi Madevi yang benar-benar dijalankan di komputer lokal. Screenshot beranda bersifat publik. Sidebar dibuka lewat tombol Menu. Profil dan dashboard diambil setelah masuk melalui formulir dengan akun demo sintetis pada database PGlite sementara. PGlite menjalankan mesin PostgreSQL ringan di proses lokal untuk pengujian.

## Prasyarat dan perintah

1. Buka terminal di **root Madevi-Site** yang berisi `package.json`. Siapkan Node.js 24 dan jalankan `npm ci --no-audit --no-fund`.
2. Pasang browser yang cocok dengan Playwright dengan `npx playwright install chromium`. Untuk Linux yang belum memiliki pustaka sistem browser, ikuti petunjuk instalasi Playwright untuk distribusi dan hak akses komputer. Chromium lokal yang sudah terpasang dapat dipilih melalui `MADEVI_CHROMIUM_PATH`. [Instalasi browser Playwright](https://playwright.dev/docs/browsers)
3. Jalankan satu perintah untuk mengambil ulang semua gambar:

```bash
npm run screenshots
```

Contoh bila memakai Chromium sistem di Linux:

```bash
MADEVI_CHROMIUM_PATH=/usr/bin/chromium npm run screenshots
```

Perintah menggunakan port loopback dinamis untuk aplikasi dan database. Salinan sementara dibuat tanpa `.env.local` atau kredensial layanan dari shell, lalu dibersihkan saat proses berakhir normal atau gagal. Setelan preview menyembunyikan indikator dev Next.js. Browser baru memakai tema terang, bahasa Indonesia, reduced motion, zona waktu Asia/Jakarta, dan viewport (area halaman yang terlihat) 1440×900 untuk desktop atau 390×844 untuk ponsel. Pengambilan gambar menunggu font dan gambar siap. Pengaturan ini berlaku pada sesi screenshot.

## Hasil dan pemeriksaan visual

| File di `docs/screenshots/` | Tampilan yang harus terlihat |
| --- | --- |
| `beranda-desktop.png` | Header, judul Madevi dan kartu ruang pada layar lebar. |
| `beranda-ponsel.png` | Header serta hero dan awal daftar ruang pada viewport ponsel. |
| `sidebar.png` | Sidebar menu terbuka dengan navigasi ruang dan kartu developer. |
| `profil.png` | Tab Status setelah login sebagai Madevi-User. |
| `admin.png` | Dashboard setelah login sebagai Madevi-Admin pada lingkungan demo. |

Buka kelimanya pada resolusi asli. Periksa bahwa isi sesuai judul, ukuran masuk akal, teks terbaca, gambar dan font tampil, serta tidak ada dialog kesalahan, data nyata, password atau kode pemulihan. Lihat preview [README](../README.md#cuplikan-aplikasi-lokal) dan jalankan `git status --short` untuk melihat gambar yang diperbarui. Jika UI berubah, simpan screenshot yang terdampak dan sesuaikan konteks sumber pada keterangan README saat diperlukan.

## Jika gagal

- Playwright tidak menemukan browser. Pasang Chromium Playwright atau isi `MADEVI_CHROMIUM_PATH` dengan jalur executable yang benar.
- Port loopback ditolak. Jalankan pada mesin pengembangan yang mengizinkan aplikasi dan database mendengarkan `127.0.0.1`. Tidak perlu membuka akses publik.
- Aplikasi belum siap atau login gagal. Periksa pesan migrasi dan Next.js di terminal. Jalankan dari checkout yang memiliki dependensi dan migrasi lengkap. Jangan melewati aturan demo atau MFA aplikasi.
- Pemuatan font/gambar atau selector gagal. Periksa file di `public/` dan tampilan lokal. Jika nama kontrol memang berubah, perbarui langkah di [scripts/screenshots.mjs](../scripts/screenshots.mjs).
- Gambar hanya disalin setelah semua sesi tangkap selesai. Bila proses berhenti sebelum itu, galeri masih berisi hasil sebelumnya. Jika penyimpanan output gagal, periksa ruang serta izin tulis, lalu ulangi perintah dan tinjau kelima hasil.
