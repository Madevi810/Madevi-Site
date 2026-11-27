# Rujukan API Madevi

API ini digunakan antarmuka Next.js pada origin Madevi. Origin adalah skema dan alamat website, misalnya `https://madevi.example`. Untuk metode yang mengubah data, sertakan header `Origin` sesuai `BETTER_AUTH_URL`. Gunakan sesi cookie dari login normal. Endpoint pengelola memeriksa izin di server. Peran istimewa memerlukan bukti MFA pada sesi tersebut. Operasi host juga memeriksa ulang kata sandi ketika membuat pekerjaan baru.

## Respons, log dan percobaan ulang

Endpoint JSON Madevi mengirim respons sesuai operasi, misalnya `{"ok":true}` atau `{"id":"…","status":"queued"}` dengan HTTP 202 saat pekerjaan tercatat. Lampiran dikirim sebagai byte dengan header yang membatasi cara browser membuka file. Header `X-Request-Id` dibuat server. Sertakan ID, waktu, dan tindakan saat melaporkan masalah.

```json
{
  "error": {"code": "CONFLICT", "message": "Data telah berubah atau tindakan bertentangan dengan status saat ini."},
  "requestId": "b7295b06-b7ff-4db2-a256-d5ab58a59298"
}
```

Kode aplikasi meliputi `INVALID_INPUT` (400/422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `BODY_TOO_LARGE` (413 jika endpoint menyatakannya), `UNSUPPORTED_MEDIA` (415), `RATE_LIMITED` (429), dan `UNAVAILABLE` (503). Ikuti `Retry-After` dalam detik pada 429. Jeda dapat berupa batas atas putaran. Pesan manusia dapat berubah. Better Auth mempertahankan kontrak library dan probe mempertahankan kontrak status probe. Next.js juga menangani metode yang tidak didukung sebelum handler.

Bila koneksi putus atau server menjawab 503 saat menulis, periksa dahulu status server. Percobaan untuk aksi berulang harus memakai ID dan isi asli. ID pesan admin bernama `requestId`, ID laporan bernama `requestId`, ID pekerjaan ops bernama `id`, dan aksi percakapan memakai `id` saat membuat atau `postId` saat membalas. ID keamanan korelasi di header berbeda dari ID tindakan dalam body. Saat 409, muat ulang objek serta versinya sebelum mengajukan tindakan baru. Tindakan tanpa ID pengulangan mengandalkan versi, identitas objek atau batas alur masing-masing sehingga periksa perubahannya sebelum mengirim ulang.

JSON standar dibaca hingga 32 KB. Unggahan memakai batas di bawah. Kegagalan server dicatat dengan route statis, metode, waktu dan ID. Worker menulis hasil serta ID pekerjaan ke journal host. Log dan ID harus digunakan bersama audit untuk penelusuran. [Pencatatan operasi](operasional.md)

## Akun, publikasi dan dukungan

| Metode dan route | Akses | Input dan hasil |
| --- | --- | --- |
| `GET /api/features`, `GET /api/health/live`, `GET /api/health/ready` | Publik | Flag email/Google, status proses, dan status koneksi/skema. Readiness memakai 503 jika dependensi gagal. |
| `GET/POST /api/auth/*`, `POST /api/register` | Bergantung aksi Better Auth. Registrasi butuh SMTP. | Registrasi Madevi menerima username, nama, tanggal lahir, kota, email, kata sandi, telepon opsional. Jalur Google dan pemulihan login mengikuti batas akun pengelola. |
| `GET/POST/PATCH /api/account/profile`, `GET/PATCH /api/account/social-profile` | Akun sendiri | GET data sendiri; POST profil melengkapi username dan tanggal lahir; PATCH menyimpan profil atau preferensi visibilitas sosial. |
| `GET/POST/DELETE /api/account/avatar` | Akun sendiri | GET varian `small`, `medium`, atau `large`; POST multipart `avatar` hingga 1 MB; DELETE hapus varian. |
| `GET /api/content`, `GET /api/content/:space/:slug` | Publik | Daftar mendukung `page`, `limit` (1–50), ruang, tipe, urut, pencarian, kategori dan tag. Detail hanya publikasi yang sah. |
| `GET /api/media/:id` | Berdasar visibilitas dan relasi media | UUID. Pustaka privat diizinkan untuk pengelola berwenang atau penerima sah. PDF, TXT dan CSV diunduh sebagai lampiran. |
| `GET/POST /api/notifications` | GET umum tersedia untuk publik; POST butuh sesi | GET memakai kategori, limit dan cursor `after`. POST UUID menandai telah dibaca secara idempoten sesuai hak pengguna. |
| `POST /api/report` | Publik, origin wajib | JSON atau multipart. Isi 10–1.000 karakter, tautan HTTP(S) opsional, foto maksimal 2 MB, dan UUID `requestId` opsional. Maksimal tiga laporan per 24 jam. Pengulangan identik memakai identitas akun/peramban yang sama. |
| `GET/POST /api/support` | Akun sendiri | GET daftar `page` atau detail `id` dan cursor `before`, 25 pesan per halaman. Gunakan cursor respons untuk pesan lebih lama; tampilan satu halaman berurutan lama ke baru. POST `create` dengan UUID, judul hingga 160 dan isi hingga 4.000 karakter; `reply` membutuhkan `postId` dan `version`. |

## Panel admin

| Metode dan route | Hasil dan batas penting |
| --- | --- |
| `GET /api/admin/summary`, `GET /api/admin/monitoring` | Agregat ringkasan serta sumber, waktu dan kesegaran pengukuran. Monitoring mencakup handler terpilih, worker dan host yang melapor. |
| `GET/POST /api/admin/content` | Filter seperti API publik, dengan status dan sampah sesuai izin. POST membuat konten dari `space`, tipe, slug, judul, body dan metadata. |
| `GET/PATCH/POST/DELETE /api/admin/content/:id` | Detail atau revisi. PATCH mengedit dan POST memindahkan status seperti `submit` atau `publish`. DELETE mengarsipkan. Perubahan memerlukan `expectedRevision`. |
| `GET/POST /api/admin/content/:id/revisions`, `POST /api/admin/content/:id/trash` | GET riwayat memakai cursor `before`. POST menyalin atau memulihkan revisi, membuang atau mengembalikan arsip dari sampah. Ketentuan versi tetap berlaku. |
| `GET/PUT/POST /api/admin/site` | Baca data dan riwayat, simpan konfigurasi situs, atau pulihkan snapshot ke versi baru. Gunakan `expectedVersion` untuk perubahan. |
| `GET/POST /api/admin/users` | Filter dan halaman, detail dengan `id`, serta tindakan akun dengan alasan. Akun pengendali tetap dilindungi. |
| `GET/PATCH /api/admin/reports`, `GET /api/admin/reports/:id/image` | Daftar terfilter, riwayat dan penanganan laporan; gambar bukti hanya untuk pengelola berizin. |
| `GET/POST/DELETE /api/admin/media` | Daftar, unggah multipart `name`, `visibility`, `file` serta UUID `id` opsional untuk pengulangan hingga 2 MB, dan hapus menurut referensi. JPG, PNG, WebP, PDF, TXT dan CSV. |
| `GET/POST /api/admin/messages`, `POST /api/admin/notifications` | `page` atau `preview` berdasarkan UUID. Aksi `draft`, `template`, `removeTemplate`, `queue`, `send`, `cancel`, `retry`. Gunakan `requestId` stabil, dan `expectedUpdated` saat mengubah pekerjaan yang dibaca. Hasil `queued` masih menunggu worker. Endpoint notifications mencatat pengumuman langsung sesuai izin dan menerima UUID `id` untuk pengulangan identik. |
| `GET/PUT /api/admin/support`, `GET/PUT /api/admin/support/availability` | Aturan FAQ/jawaban, mode admin, zona IANA dan maksimal 28 rentang mingguan tanpa tumpang tindih. PUT ketersediaan memeriksa `version`. |
| `GET/POST /api/admin/support/conversations` | Halaman atau cursor seperti pengguna. UUID `postId` dan `version` untuk balasan, catatan internal, selesai atau buka kembali. |
| `GET/POST /api/admin/operations`, `GET /api/admin/operations/artifacts/:id` | `page` dan `backups` untuk daftar, `request=<uuid>` untuk memeriksa pengajuan sendiri setelah koneksi putus. POST menerima UUID, jenis operasi, konfirmasi, kata sandi dan ID artefak bila diperlukan. Unduhan membutuhkan MFA dan mount privat. |

Worker pesan dan operasi tidak mengakses endpoint admin melalui HTTP. Keduanya membaca antrean PostgreSQL dengan transaksi dan penguncian. Probe kesehatan dari host memakai loopback. Jadwal dan cara membaca log tersedia pada [panduan systemd](../ops/systemd/README.md).
