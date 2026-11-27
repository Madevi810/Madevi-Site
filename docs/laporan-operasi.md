# Penguatan fondasi operasi Madevi

Pekerjaan dimulai dengan checkout bersih pada `86d7a41` (Madevi V0.0.0.21). Perubahan ini tercatat pada [Madevi V0.0.0.22](../CHANGELOG.md). Migrasi `006_operational_reliability` memperluas skema. SQL dan checksum rilis sebelumnya dipertahankan.

| Kebutuhan | Implementasi dan lokasi | Pemeriksaan dan batas |
| --- | --- | --- |
| Kontrak API dan penelusuran | Error JSON stabil, `X-Request-Id`, status terkontrol dan `Retry-After`. Better Auth dan probe mempertahankan format. [Kontrak](api.md), [batas handler](../src/lib/api-response.ts) | Smoke runtime dan endpoint dengan database tak terjangkau. Log hanya memuat route, metode, kode, waktu, dan ID korelasi. Perubahan framework di luar handler mengikuti Next.js. |
| Pengajuan yang terputus | Pesan mengikat ID ke tindakan yang disimpan. Pengumuman, media, laporan dan percakapan mengecek ID dan isi. Operasi host dapat dicari berdasarkan ID peminta dan diulang dengan ID yang sama. [API](api.md) | Chromium menguji respons hilang setelah operasi backup dan balasan dukungan tersimpan. PostgreSQL menguji pengulangan identik dan konflik. Browser menyimpan percobaan pada panel yang sedang dibuka. Setelah menutup panel, periksa riwayat sebelum membuat permintaan baru. |
| Urutan dan privasi dukungan | Posisi PostgreSQL, cursor, formulir jadwal, verifikasi zona dan pemisahan catatan. [Penyimpanan](../src/lib/support-threads.ts), [panduan admin](admin.md) | Periksa pertanyaan sebelum respons otomatis, halaman lama saat ada tulisan baru, konflik versi, akses lintas akun, serta balasan dua arah di Chromium. |
| Operasi host | Kesiapan, fase dan waktu pembaruan; worker terhubung ke enkripsi, verifikasi, unduh, restore kosong dan rollback katalog. [Alur admin](operasi-admin.md) | PostgreSQL sintetis untuk alur admin dan target; Docker Compose memakai container fixture untuk pergantian profil dan pemulihan saat probe 503. Katalog, image dan izin host pemilik baru diperiksa saat aktivasi. |
| Jadwal dan retensi | Template systemd, interval backup berbasis riwayat, pembersihan limiter/metrik per batch dengan default `dry-run`. Artefak diberi tinjauan retensi dengan perlindungan referensi aktif. [Host dan retensi](../ops/systemd/README.md) | Cadangan terjadwal menggunakan enkripsi dan penguncian yang sama. Semua artefak dipertahankan oleh scheduler. Penghapusan fisik tetap tindakan operator dengan catatan dan salinan di lokasi terpisah. |
| Monitoring dan alarm | Metrik dari handler dan worker, status kesiapan berlapis, SMTP dengan keadaan lokal, jeda dan batas pengulangan. [Alarm](../ops/systemd/README.md#alarm-smtp-dan-respons-gangguan) | Unit menjalankan transisi dan kegagalan transport, integrasi memakai SMTP loopback. Pemantauan eksternal dibutuhkan jika seluruh host mati. |

## Hasil verifikasi lokal

- `npm run typecheck` dan `npm test` lulus. Build Next.js dan smoke `next start` lulus, termasuk HTTP 503 terkontrol pada runtime yang memakai endpoint PostgreSQL tak terjangkau.
- Pengujian PostgreSQL 18 dan Chromium memakai akun serta data sintetis. Suite memeriksa migrasi data percakapan lama, role database tanpa superuser, admin tunggal/MFA, konflik versi, akses privat, kirim langsung dan jadwal, pengulangan permintaan, status worker kedaluwarsa dan terputus, kegagalan verifikasi, serta retensi per batch.
- Uji backup membuktikan verifikasi AES-GCM, penolakan kunci dan artefak yang salah, penolakan target tidak kosong, serta kesamaan checksum migrasi dan media hasil restore. Uji Docker Compose membuat ulang container fixture dan mengembalikan profil sebelumnya setelah probe readiness gagal.
- Uji SMTP loopback membuktikan pemberitahuan gangguan dan pulih. Eksekutor alarm juga mengirim sekali saat aplikasi dan PostgreSQL tidak dapat dijangkau, serta memuat kembali status saat dieksekusi ulang.
- Unit systemd diperiksa secara statis pada salinan sementara dengan jalur Node lingkungan uji. Enam cuplikan galeri diambil dan ditinjau. Cuplikan panel yang berubah disimpan di [galeri README](../README.md#cuplikan-aplikasi-lokal).

## Aktivasi dan tahap berikutnya

Baca [aktivasi default](aktivasi-default.md) untuk database, origin, akun dan layanan. Ikuti [panduan systemd](../ops/systemd/README.md) untuk penjadwalan, kemudian uji pesan, salinan backup, target kosong dan alarm pada staging. Penyedia, domain, timer host tujuan, profil produksi, OAuth, mail produksi dan pengiriman alarm nyata masih menunggu konfigurasi dan pengujian operator.

Pekerjaan berikutnya mencakup taksonomi dan isi Explore & Learn serta Tutorial & Problem Solve, lalu desain modul khusus untuk ruang lain. [Urutan pengembangan](lanjutan.md)
