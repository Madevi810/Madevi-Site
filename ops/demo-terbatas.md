# Akun demo sementara

Akun demo dimaksudkan hanya untuk development lokal terisolasi dan data sintetis, sesuai keputusan Ade. Akun asli memakai jalur verifikasi email; admin non-demo memerlukan MFA. Demo tidak boleh di staging, produksi, database nyata, atau site publik.

Untuk mengaktifkan pada mesin lokal, gunakan database development baru yang hanya berisi data pengujian; `MADEVI_ENV=dev`, `MADEVI_DEMO_MODE=true`, `DATABASE_URL` dan `BETTER_AUTH_URL` menunjuk ke localhost atau loopback, dan `TRUST_PROXY_HEADERS=false`. Password demo dimasukkan sebagai `DEMO_PASSWORD` melalui environment privat; tidak ada password bawaan di repo. Jalankan migrasi dan `npm run db:seed-demo`; server development standar `npm run dev` mendengarkan 127.0.0.1. Jangan meneruskan port ke internet atau membagikan akses mesin.

Validasi URL dan alamat loopback hanyalah pengaman tambahan: itu tidak memverifikasi identitas server, isolasi container/SSH atau isi database. Jangan gunakan URL lokal yang meneruskan koneksi ke database jarak jauh, mengubah file hosts, atau membuka port melalui proxy. Pengujian di jaringan lain memerlukan lingkungan yang dirancang aman dan keputusan terpisah.

Penghapusan saat beralih ke layanan: matikan flag demo, siapkan database staging/produksi baru tanpa demo, buat admin asli sesuai prosedur lalu aktifkan MFA. Setelah pengujian dan keputusan Ade, hapus kode pengecualian demo dan skrip seed dengan migrasi skema yang aman. Jangan menghapus atau memodifikasi database nyata melalui skrip development. Belum ada bukti uji staging/produksi.
