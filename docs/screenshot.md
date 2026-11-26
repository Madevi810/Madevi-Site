# Memperbarui screenshot README

Galeri merekam aplikasi Madevi yang benar-benar dijalankan di komputer lokal. Profil memakai akun demo sintetis. Dashboard memakai admin sintetis dengan MFA pada PostgreSQL uji.

## Prasyarat dan perintah

1. Buka terminal di **root Madevi-Site** yang berisi `package.json`. Siapkan Node.js 24 dan jalankan `npm ci --no-audit --no-fund`.
2. Pasang browser dengan `npx playwright install chromium`. Chromium sistem dapat dipilih dengan `MADEVI_CHROMIUM_PATH`. [Instalasi browser Playwright](https://playwright.dev/docs/browsers)
3. Buat database PostgreSQL lokal **baru dan kosong** bernama `madevi_ci_screenshots` atau `madevi_ci_screenshots_<id>`. Role pengujian memerlukan hak untuk membuat skema. Buat database baru untuk pengambilan berikutnya. Masukkan URI role sintetis melalui environment privat. Contoh di bawah hanya memakai placeholder.

```bash
MADEVI_TEST_DATABASE_URL='postgresql://ROLE:PASSWORD@127.0.0.1:5432/madevi_ci_screenshots' npm run screenshots
```

Skrip menjalankan aplikasi asli dari checkout pada port loopback dinamis. Ia memeriksa database uji, menjalankan migrasi dan membuat akun sintetis. Admin login dengan password lalu menyelesaikan aktivasi autentikator melalui UI. Browser baru memakai tema terang, bahasa Indonesia, reduced motion, zona waktu Asia/Jakarta, dan viewport 1440×900 untuk desktop atau 390×844 untuk ponsel. Pengambilan menunggu font dan gambar siap. Masa berlaku konfigurasi uji terbatas pada proses screenshot. Database uji dapat dibersihkan setelah bukti diperiksa.

## Hasil dan pemeriksaan visual

| File di `docs/screenshots/` | Tampilan yang harus terlihat |
| --- | --- |
| `beranda-desktop.png` | Header, judul Madevi dan kartu ruang pada layar lebar. |
| `beranda-ponsel.png` | Header serta hero dan awal daftar ruang pada viewport ponsel. |
| `sidebar.png` | Sidebar menu terbuka dengan navigasi ruang dan kartu developer. |
| `profil.png` | Tab Status setelah login sebagai Madevi-User. |
| `admin.png` | Dashboard setelah login sebagai Madevi-Admin dengan MFA pada lingkungan pengujian. |

Buka kelimanya pada resolusi asli. Periksa bahwa isi sesuai judul, ukuran masuk akal, teks terbaca, gambar dan font tampil, serta tidak ada dialog kesalahan, data nyata, password atau kode pemulihan. Lihat preview [README](../README.md#cuplikan-aplikasi-lokal) dan jalankan `git status --short` untuk melihat gambar yang diperbarui. Jika UI berubah, simpan screenshot yang terdampak dan sesuaikan konteks sumber pada keterangan README saat diperlukan.

## Jika gagal

- Playwright tidak menemukan browser. Pasang Chromium Playwright atau isi `MADEVI_CHROMIUM_PATH` dengan jalur executable yang benar.
- Port loopback ditolak. Jalankan pada mesin pengembangan yang mengizinkan aplikasi dan database mendengarkan `127.0.0.1`. Tidak perlu membuka akses publik.
- Aplikasi belum siap atau login gagal. Periksa pesan migrasi dan Next.js di terminal. Jalankan dari checkout yang memiliki dependensi dan migrasi lengkap. Jangan melewati aturan demo atau MFA aplikasi.
- Pemuatan font/gambar atau selector gagal. Periksa file di `public/` dan tampilan lokal. Jika nama kontrol memang berubah, perbarui langkah di [scripts/screenshots.mjs](../scripts/screenshots.mjs).
- Gambar hanya disalin setelah semua sesi tangkap selesai. Bila proses berhenti sebelum itu, galeri masih berisi hasil sebelumnya. Jika penyimpanan output gagal, periksa ruang serta izin tulis, lalu ulangi perintah dan tinjau kelima hasil.
