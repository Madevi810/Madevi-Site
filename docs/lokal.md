# Menjalankan Madevi di komputer sendiri

Pengembangan lokal memakai alamat `127.0.0.1`, yaitu alamat yang dapat diakses dari komputer sendiri. Madevi membaca akun, konten dan notifikasi dari PostgreSQL. Menjalankan halaman HTML saja tidak cukup untuk mencoba aplikasi. Siapkan Node.js 24, npm, checkout repo Madevi-Site, terminal, dan browser. Untuk database, pilih Docker Compose atau PostgreSQL lokal yang sudah tersedia.

Contoh perintah memakai Bash. Jalankan semua perintah dari **root Madevi-Site**, yaitu folder yang berisi `package.json`. Jalankan `node -v` untuk memastikan versi 24 dan `npm -v` untuk memeriksa npm. Instal dependensi dari lockfile dengan:

```bash
npm ci --no-audit --no-fund
```

## 1. Siapkan database lokal

**Dengan Docker Compose.** Nyalakan Docker dan periksa `docker compose version`. Jalankan layanan postgres dari konfigurasi uji.

```bash
docker compose -f compose.test.yml up -d postgres
docker compose -f compose.test.yml ps
```

Tunggu status `healthy`. Contoh uji membuat database `madevi_ci_test` dengan role `madevi_test`, password sintetis `local-test-only` dan port host `25435`. Nama serta password ini memang ada di [compose.test.yml](../compose.test.yml) dan hanya untuk data latihan. Pisahkan database yang ingin disimpan jangka panjang. Konfigurasi uji memakai container sementara tanpa volume persisten yang dikelola sebagai penyimpanan Madevi. Gunakan `docker compose -f compose.test.yml stop postgres` untuk berhenti sementara.

**Dengan PostgreSQL lokal yang sudah terpasang.** Buat database khusus development dan role yang berhak membuat tabel di database tersebut. Ambil host, port, database, username, dan password role dari konfigurasi PostgreSQL. Port bawaan biasanya `5432`. Gunakan host `127.0.0.1` untuk demo dan pertahankan koneksi terpisah dari database orang lain.

## 2. Isi konfigurasi lokal

Variabel environment adalah nilai yang diberikan ke program saat jalan. `.env.local` menyimpannya untuk komputer ini. Jika file belum ada, salin [.env.example](../.env.example) dengan `cp .env.example .env.local`. Buka file lokal itu di editor. Berikut contoh untuk Compose uji:

```dotenv
DATABASE_URL=postgresql://madevi_test:local-test-only@127.0.0.1:25435/madevi_ci_test
BETTER_AUTH_URL=http://127.0.0.1:3000
BETTER_AUTH_SECRET=<ISI_NILAI_ACAK_DI_KOMPUTER_SENDIRI>
MADEVI_ENV=dev
MADEVI_DEMO_MODE=false
MEDIA_BACKEND=postgres
TRUST_PROXY_HEADERS=false
```

Ganti placeholder secret dengan keluaran `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` dari terminal privat. Secret dipakai oleh autentikasi dan perlindungan request. Jika menggunakan PostgreSQL sendiri, ganti komponen URI sesuai akses lokal. URI adalah alamat koneksi lengkap. Enkode karakter khusus pada nama/password jika menyusun URI sendiri. Simpan file tetap privat dan jaga agar tidak ikut commit atau tangkapan layar. Biarkan SMTP dan Google kosong untuk percobaan lokal biasa.

Jalankan migrasi untuk membuat tabel dasar. Setelah tertulis `Migrasi selesai.`, jalankan server pengembangan:

```bash
npm run db:migrate
npm run dev
```

Buka `http://127.0.0.1:3000`. Coba halaman beranda dan satu ruang. Buka `http://127.0.0.1:3000/api/health/ready`. Respons `{"status":"ok","database":"ok"}` menunjukkan aplikasi dapat melihat database dan catatan migrasi yang diperlukan.

## 3. Coba akun dan admin

Langkah ini opsional. Di `.env.local`, isi `MADEVI_DEMO_MODE=true` dan buat `DEMO_PASSWORD` sintetis minimal 10 karakter. Database dan origin harus tetap loopback, tanpa proxy tepercaya. Jalankan `npm run db:seed-demo` dan restart `npm run dev`. Buka sidebar → Profil → Masuk dengan `Madevi-User`. Untuk admin, buka `/admin` dan masuk dengan `Madevi-Admin`. Gunakan password demo lokal pada keduanya. Pengecualian MFA untuk admin demo hanya berlaku pada kondisi dev lokal yang diperiksa aplikasi. Setelah mencoba, matikan flag dan restart bila ingin kembali memakai mode biasa. [Batas dan penutupan demo](../ops/demo-terbatas.md)

Untuk melihat cara admin non-demo diinisialisasi, gunakan [bootstrap dan MFA](online.md#5-buat-admin-dan-uji-alur). Skrip pemilik menolak pembuatan jika sudah ada admin pada database itu. Gunakan database uji kosong terpisah bila ingin mencoba jalur non-demo.

## 4. Periksa dan atasi masalah

| Gejala | Yang diperiksa |
| --- | --- |
| `npm ci` gagal | Jalankan dari folder yang berisi `package-lock.json`. Periksa versi Node, akses ke registry npm dan sertifikat/proxy organisasi bila ada. |
| `ECONNREFUSED` atau readiness 503 | Periksa status PostgreSQL, port dan isi `DATABASE_URL` secara privat. Jalankan migrasi untuk database yang benar, lalu ulangi readiness. |
| Next.js memakai port lain | Bebaskan 3000, atau pilih port tetap dengan `npm run dev -- --port 3100` dan samakan origin dengan `http://127.0.0.1:3100`. Migrasi dan runtime membaca origin dari konfigurasi. |
| Gagal masuk sebagai demo | Periksa flag, isi password demo, hasil seed, dan pastikan URL di browser persis sama dengan `BETTER_AUTH_URL`. Gunakan sesi browser baru jika mengganti origin. |
| Daftar email atau Google tidak tersedia | Fitur ini membutuhkan konfigurasi penyedia untuk bekerja. Demo dan [uji integrasi](laporan-penataan.md) bisa dipakai untuk alur lokal. |

Untuk memeriksa perubahan, gunakan `npm run typecheck` dan `npm test`. `npm run test:integration` membuka port loopback 3000, 25433 dan 25434. Hentikan server dev bila bentrok. Runner itu memakai database sementara PGlite dan server SMTP palsu. Perintah [screenshot](screenshot.md) memakai database sementara dan port sendiri.
