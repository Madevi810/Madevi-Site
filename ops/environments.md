# Lingkungan dan konfigurasi

Pemisahan berikut adalah rancangan yang dapat dijalankan, bukan layanan yang sudah dibuat.

| Lingkungan | `MADEVI_ENV` | Database | Demo | Akses |
| --- | --- | --- | --- | --- |
| Development | `dev` | Database uji sendiri | Hanya jika flag aktif, origin dan database loopback, tanpa proxy tepercaya, dan bukan production | Hanya lokal terisolasi; lihat `demo-terbatas.md` |
| Staging | `staging` | Database dan rahasia terpisah, data sintetis | Nonaktif | HTTPS dan akses terbatas |
| Production | `production` | Database, rahasia, storage, cadangan dan jalur rilis tersendiri | Nonaktif | HTTPS dan kontrol yang diuji |

Copy `.env.example` ke `.env.local` hanya pada mesin lokal; untuk staging/produksi gunakan secret manager penyedia. `BETTER_AUTH_URL` adalah origin tanpa path; gunakan kunci acak berbeda. Kode memvalidasi variabel penting saat startup, pasangan Google/SMTP, dan melarang demo di staging/production. Login Google dan SMTP asli tetap harus diuji.

`TRUST_PROXY_HEADERS=true` hanya boleh digunakan bila origin tidak dapat diakses langsung dan reverse proxy tepercaya menghapus serta mengisi `X-Real-IP`. Default tidak mempercayai header dan memakai satu bucket bersama, yang aman secara konservatif tetapi bisa membatasi banyak pengguna. Tambahkan rate limit dan batas ukuran request di edge; limiter aplikasi berbasis PostgreSQL bukan perlindungan DDoS atau pengganti WAF. Atur pembersihan tabel `madevi_rate_limits` dan retensi `madevi_security_events` secara terkelola sebelum produksi; belum ada scheduler aktif.

Database, media, email, domain, biaya, penyedia dan izin akses belum dipilih. `compose.test.yml` hanya untuk pengujian lokal; `compose.yml` adalah contoh server aplikasi yang belum diverifikasi; jangan gunakan password contoh dan jangan membuka port PostgreSQL ke internet. Image Docker/CI perlu dijalankan dan diverifikasi pada penyedia yang dipilih; label versi image belum dipin ke digest.
