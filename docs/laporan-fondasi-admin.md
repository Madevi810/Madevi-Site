# Laporan penataan fondasi dan admin

Madevi V0.0.0.20 melanjutkan fondasi V0.0.0.19. Migrasi baru `004_admin_foundation` menambah data administrasi. Migrasi V0.0.0.19 dan sebelumnya tetap dipertahankan. Perubahan dicatat dalam [riwayat rilis](../CHANGELOG.md).

## Temuan dan perubahan

| Temuan | Perubahan |
| --- | --- |
| Halaman ruang menampilkan pesan persiapan walaupun konten bisa diterbitkan. | Halaman ruang, pencarian, halaman baca dan API mengikuti revisi terbit yang sama. Pencarian dapat difilter dan dilanjutkan per halaman. Arsip, sampah, revisi draf dan lampiran privat dikecualikan dari tampilan publik. |
| Dashboard tidak memuat angka dari aplikasi. | Dashboard dan statistik membaca agregat PostgreSQL, status migrasi, peristiwa keamanan, kapasitas, laporan, serta riwayat pekerjaan. Kapasitas yang gagal diukur dilaporkan belum tersedia. |
| Editor hanya mengubah teks dan status. | Tambah metadata editorial, lampiran, pratinjau, salin draf, riwayat dan pemulihan revisi. Pengaturan halaman informasi dan footer memakai data tervalidasi dengan pemeriksaan konflik. |
| Pengelolaan akun hanya membedakan blokir dan pulih. | Tambah suspend berbatas waktu, banned, cabut sesi, pencarian status dan catatan pelaksana. Admin utama dilindungi dan sesi akun yang dibatasi dicabut. |
| Pengiriman hanya berupa notifikasi umum atau langsung ke satu akun. | Tambah draf, template, pratinjau, filter penerima, lampiran privat, jadwal, pembatalan, retry dan status baca. Worker memakai baris antrean dan satu notifikasi per pasangan pekerjaan/penerima. |
| Laporan tidak mempunyai prioritas dan catatan penyelesaian. | Tambah prioritas, bukti privat, riwayat penanganan, serta respons aturan kata kunci dan waktu yang dikelola admin. |
| Status operasi berupa penanda. | Panel membaca kesiapan, checksum dan riwayat. Host menjalankan backup AES-GCM, verifikasi dan restore transaksional dengan konfirmasi target kosong. Uji awal menemukan `pg_dump --schema=public` menyertakan perintah pembuatan skema yang berbenturan dengan target default. Dump database Madevi sekarang mengikuti format custom standar. |
| Formulir admin dapat memakai pengiriman HTML bawaan sebelum JavaScript siap. | Login dan penyiapan autentikator memakai POST dan tombol menunggu hidrasi. Masalah ditemukan saat mengambil screenshot memakai kredensial sintetis. Formulir profil dan pemulihan yang mengirim data juga menetapkan POST. |
| Header admin terpotong pada viewport kecil. | Dasarkan ukuran tombol dan jarak pada breakpoint. Periksa posisi header pada lebar 320 dan 390 piksel dan navigasi desktop. |

## Verifikasi

- **Unit dan dokumentasi.** Typecheck dan 21 tes unit lulus. Jalur berkas, tautan dan sebagian kontrak konfigurasi dicocokkan dengan repository. Pemindaian perubahan teks tidak menemukan pola umum kredensial.

- **PostgreSQL 18 terisolasi.** Migrasi dan pengulangan, rollback database kosong, konten hingga terbit, pengujian slug bersamaan, filter, izin media dan pesan, aturan dukungan, penanganan laporan dan pembatasan akun diuji dengan data sintetis. Satu pembuatan slug bersamaan menang dan permintaan lain mendapat 409.
- **Role database.** Migrasi dan bootstrap pemilik lulus dengan role non-superuser. Bootstrap berikutnya ditolak. Runtime tidak dapat membuat objek atau mengubah riwayat migrasi. Role backup memiliki akses baca tabel dan sequence.
- **Browser dan runtime.** Build Next.js dan smoke `next start` lulus. Chromium menguji navigasi, layar 320/390/1440 piksel, profil, tema, dan foto pendaftaran. Pemeriksaan axe mencakup laci menu publik serta login admin. SMTP memakai server sintetis. Uji ringan PostgreSQL memproses 30 permintaan dengan tiga permintaan bersamaan tanpa error.
- **Galeri README.** Lima PNG diambil dari checkout yang dijalankan dengan PostgreSQL uji. Admin menyelesaikan MFA dari formulir. Pintasan Pesan membuka tab Sistem untuk akun yang sudah masuk. Galeri diperiksa secara visual. [Prosedur screenshot](screenshot.md)
- **Backup.** Backup AES-GCM berhasil, kunci salah dan ciphertext rusak ditolak. Restore berhasil ke PostgreSQL kosong terpisah dengan checksum dan jumlah media yang cocok. Target salah dan target yang sudah berisi ditolak.
- **Perbedaan PGlite.** Dua koneksi `pg.Client` yang membuka transaksi pada `pglite-server` mengembalikan `txid_current()` yang sama. Ini menunjukkan runner wire berbagi satu konteks transaksi. PostgreSQL 18 dipakai untuk keputusan tentang konkurensi, isolasi, dan fault injection. Runner default PGlite lulus pada percobaan ini dengan pengecualian fault injection dan alur admin baru yang dicakup PostgreSQL. Kode produksi tetap memakai PostgreSQL.

## Batas aktivasi

Pemilik masih perlu menyediakan host atau Docker, PostgreSQL, origin HTTPS dan konfigurasi proxy, serta SMTP untuk alur email. OAuth Google opsional. Jadwal worker, backup dan pemantauan host tetap perlu diaktifkan oleh operator. Panel memantau pekerjaan pemulihan. Proses restore dijalankan lewat host dengan pemeriksaan ulang identitas dan konfirmasi target. Modul khusus tiap ruang, kampanye email, object storage, dashboard uptime eksternal dan isi kebijakan publik masih memerlukan pekerjaan atau keputusan. Tugas ini menguji konfigurasi CI secara lokal pada layanan sintetis. Pemeriksaan di GitHub Actions, jaringan staging, dan API penyedia sungguhan belum dijalankan untuk perubahan ini.

Mulai dari [panduan admin](admin.md), [aktivasi default](aktivasi-default.md), dan [backup serta pemulihan](../ops/backup-restore.md).
