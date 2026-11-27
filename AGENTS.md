<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Panduan kerja Madevi

- Madevi adalah satu aplikasi edukasi dan layanan digital untuk tujuh ruang. Prioritaskan Explore & Learn dan Tutorial & Problem Solve. Gunakan [fundamental](docs/fundamental.md) untuk batas fitur dan keputusan produk, serta [indeks dokumentasi](docs/README.md) untuk prosedur.
- Mulai dengan `git status --short` dan tinjau diff yang ada. Jaga perubahan pengguna. Baca `AGENTS.md` yang lebih spesifik pada jalur yang disentuh, bila ada. Folder Pondasi dalam paket terpisah adalah sumber keputusan desain dan riwayat.
- Jalankan `npm ci` dengan Node.js 24. Buat `.env.local` dari `.env.example` bila belum ada, isi konfigurasi lokal, lalu jalankan `npm run db:migrate` dan `npm run dev`. Gunakan PostgreSQL uji terpisah. Build memakai mode staging/production dan origin HTTPS, sesuai [panduan online](docs/online.md).
- Verifikasi dengan `npm run typecheck`, `npm test` dan, untuk alur akun, data atau routing, `npm run test:integration`. Gunakan `MADEVI_TEST_BUILD=1 npm run test:integration` untuk menyertakan build. Uji konkurensi dan alur admin dengan `MADEVI_TEST_DATABASE_URL` ke PostgreSQL loopback terisolasi bernama `madevi_ci_*`. Catat hasil dan batas pengujian yang benar-benar dijalankan.
- Simpan routing di `src/app`, komponen React di `src/components`, dan logika bersama di `src/lib`. Ikuti penamaan route Next.js dan gaya setempat. Gunakan kembali komponen dan token CSS yang tersedia. Taruh hanya aset publik di `public` dan pertahankan lisensinya.
- Jaga pool, rahasia, media privat dan pemeriksaan izin di server. Validasi input di Route Handler dan periksa sesi, peran serta MFA melalui `src/lib/access.ts`. Klien memakai `src/lib/auth-client.ts` dan API, dengan state permintaan dan kegagalan yang jelas.
- Simpan migrasi berurutan di `scripts/migrations` dan daftarkan di `src/lib/schema-version.ts`. Tambahkan migrasi baru untuk perubahan skema dan pertahankan checksum migrasi yang sudah diterapkan. Gunakan rollback uji hanya pada database development kosong sesuai pengaman skrip.
- Gunakan placeholder aman di `.env.example`. Simpan rahasia, dump, dan data pengguna di luar Git, aset publik, serta keluaran log. Demo hanya untuk development lokal terisolasi.
- Untuk perubahan UI yang memengaruhi galeri README, siapkan database PostgreSQL screenshot terisolasi lalu jalankan `npm run screenshots` dari root, periksa hasil secara visual, dan perbarui cuplikan terkait. Laporkan bila pengambilan ulang terhambat. Lihat [panduan screenshot](docs/screenshot.md).
- Untuk antrean pesan dan backup, pertahankan worker dan operasi host yang terstruktur. Worker operasi memakai database lingkungan yang sama dan penguncian bersama skrip backup. Periksa ulang identitas admin, artefak, skema dan target. Pertahankan katalog Compose terstruktur di host serta mount unduhan baca-saja. [Prosedur operasi](docs/aktivasi-default.md#6-siapkan-pekerjaan-host)
- Pakai `apiRoute` untuk response error dan korelasi pada Route Handler. Pertahankan format Better Auth dan probe. Ikat ID pengulangan ke isi tindakan dan jangan menyimpan password browser saat menunggu hasil. Gunakan fixture PostgreSQL dan SMTP loopback. [Kontrak API](docs/api.md)
- Pertahankan izin sesi di server, hak database eksplisit dan pengaman pemulihan host. Uji role negatif dan pemeriksaan keamanan yang terdampak. [Model keamanan](docs/keamanan.md)
- Perbarui panduan dan contoh ketika kontrak atau prosedur berubah. Catat pekerjaan berjalan di bagian belum dirilis pada `CHANGELOG.md`. Sumber versi tampilan ialah `VERSION` di `src/lib/rooms.ts`. Saat rilis resmi sinkronkan manifest dan lockfile dalam format npm, serta blok versi README dan CHANGELOG dalam format empat bagian Madevi.
- Minta persetujuan pemilik sebelum membeli layanan, mendaftarkan akun eksternal, deploy atau mengubah produksi, DNS, akses layanan, dan menjalankan tindakan destruktif.
