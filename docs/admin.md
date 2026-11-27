# Panduan panel admin Madevi

Buka `/admin` melalui alamat Madevi. Untuk penggunaan tetap, masuk dengan akun pemilik dan aktifkan autentikator TOTP, yaitu aplikasi yang menghasilkan kode sekali pakai. Simpan kode pemulihan di pengelola rahasia. Sistem melindungi akun admin utama dari tindakan pembatasan di panel. Akun pengunjung mengikuti alur pendaftaran biasa. Untuk lingkungan baru, ikuti [bootstrap dan MFA](aktivasi-default.md#5-jalankan-staging-uji-fitur-dan-putuskan-promosi).

Gunakan sidebar di desktop atau tombol **Menu admin** di ponsel. **Cari di panel** mencari tujuan menu. Perluas submenu Ruang Madevi untuk memilih ruang. Jejak navigasi di atas judul menunjukkan bagian aktif. Tombol roda gigi mengatur tema terang/gelap dan membuka Pengaturan Website.

| Menu | Cara menggunakan |
| --- | --- |
| Dashboard | Baca jumlah akun, konten yang dapat dibaca, laporan terbuka dan status database. Klik kartu untuk membuka daftar yang sesuai. Waktu snapshot memakai waktu lokal browser. |
| Ruang Madevi | Pilih salah satu dari tujuh ruang. Isi draf, filter daftar dan periksa pratinjau sebelum publikasi. |
| Halaman & Navigasi | Ubah teks dan visibilitas Tentang, Privasi, Ketentuan, Bantuan. Tambah sampai 12 tautan footer dengan format `Label | /info/bantuan` atau URL HTTPS. |
| Pengguna | Cari nama, username atau email. Buka detail untuk memeriksa status, jumlah sesi, ID akun dan riwayat tindakan. |
| Media & Berkas | Unggah JPEG, PNG, WebP, PDF, TXT, atau CSV hingga 2 MB per berkas dan 256 MB untuk seluruh pustaka. Salin ID untuk lampiran konten atau pesan. |
| Notifikasi & Pesan | Buat template, pratinjau, pilih penerima, simpan draf, kirim langsung atau jadwalkan. Pantau status terkirim, gagal dan jumlah dibaca. |
| Asisten & Respons Otomatis | Atur jam, zona waktu dan respons saat tidak tersedia. Tangani percakapan dan catatan internal. |
| Laporan & Dukungan | Buka bukti privat, pilih prioritas dan status, catat penanganan dan baca riwayat. |
| Statistik & Monitoring | Tinjau status akun dan konten saat ini, jumlah laporan/pekerjaan sepanjang riwayat, kapasitas, dan peristiwa keamanan 24 jam. |
| Database & Pemulihan | Ajukan backup, verifikasi arsip, unduh terenkripsi, periksa target dan ajukan restore atau rollback. Pantau worker dari riwayat. |
| Pengaturan Website | Ubah pengumuman, bandingkan snapshot dan pulihkan sebagai versi baru. |
| Keamanan & Audit | Lihat tindakan terkini dan peristiwa keamanan. Buka halaman keamanan admin untuk melihat status autentikator. |

## Terbitkan dan pulihkan konten

1. Buka **Ruang Madevi**, lalu pilih ruang. Gunakan jenis yang telah disepakati untuk artikel teks, misalnya `article`. Gunakan slug seperti `panduan-contoh`, yaitu bagian alamat yang unik dalam ruang. Slug dipertahankan untuk menjaga alamat. Buat salinan dengan slug baru untuk menerbitkan versi berbeda.
2. Isi judul, isi teks dengan satu baris kosong antarparagraf, kategori, tag, ringkasan, dan rujukan. Kategori dan tag adalah nilai editorial yang dapat difilter dari daftar atau halaman publik. Rujukan memakai format `Dokumentasi | https://example.invalid/panduan`.
3. Untuk lampiran, unggah dahulu sebagai **Publik saat revisi terkait diterbitkan**. Masukkan ID satu per baris. Berkas hanya dapat dibuka publik saat terhubung dengan revisi yang benar-benar terbit. File yang masih dipakai oleh revisi lama atau pesan dilindungi dari penghapusan.
4. Simpan draf, buka **Revisi dan pratinjau** lalu periksa isi. Gunakan **Ajukan**, **Setujui** dan **Terbitkan** sesuai urutan. Buka ruang publik dan tautan baca di jendela privat. Untuk menurunkan materi, pilih **Arsipkan**. Dari arsip, **Hapus** memindahkan ke tempat sampah. Lihat kembali melalui filter status.
5. Untuk memulihkan revisi, pilih revisi lama dan **Pulihkan sebagai draf**. Tinjau draf sebelum menerbitkan. Revisi publik tetap tampil selama versi baru masih berupa draf. Jika muncul konflik, muat ulang lalu bandingkan perubahannya sebelum menyimpan lagi.

Editor ini menangani konten dan metadata bersama. Kurikulum, ujian, transaksi, katalog, pemesanan, dan fitur sosial membutuhkan rancangan serta model data masing-masing ruang.

## Batasi akun dan tangani laporan

Pada detail akun, pilih **Blokir** untuk menutup akses sampai dipulihkan, **Suspend sementara** untuk menetapkan tanggal akhir, **Banned** untuk larangan tanpa tenggat, atau **Cabut sesi** untuk mengakhiri sesi tanpa mengubah status pembatasan. **Pulihkan** membuka akses sesuai status verifikasi email. Selalu isi alasan dan periksa nama akun pada layar sebelum konfirmasi. Akun dan isi riwayat tetap tersimpan.

Pada **Laporan & Dukungan**, lihat bukti privat hanya ketika diperlukan. Tetapkan prioritas, status dan catatan. Riwayat menunjukkan keputusan, waktu dan pelaksana. Pada **Asisten & Respons Otomatis**, buat jawaban dengan kata kunci seperti `panduan`. Sistem mencari kecocokan teks tanpa membedakan huruf besar/kecil dan mengutamakan kata kunci terpanjang. Kata kunci kosong menjadi jawaban umum. Jadwalkan rentang aktif bila jawaban hanya berlaku pada waktu tertentu. Semua laporan tetap masuk antrean pemeriksaan. Hindari isi rahasia pada respons karena ditampilkan kembali kepada pengirim.

## Buat dan kirim pesan

1. Tulis sendiri atau buat template. `{{nama}}` diisi nama penerima dan `{{situs}}` diisi Madevi. **Pratinjau** memakai nama contoh.
2. Pilih satu akun dengan ID dari detail pengguna, kelompok menurut verifikasi email, atau seluruh akun yang memiliki akses. Untuk pesan dengan lampiran, pilih ID dari pustaka. Lampiran privat dapat dibuka oleh penerima sebenarnya dan admin melalui sesi yang berizin.
3. Simpan draf. Dari daftar, pilih **Kirim sekarang** atau **Jadwalkan**. Periksa cakupan yang dihitung, isi, lampiran dan waktu. Konfirmasi untuk memproses. Pilih **Batalkan pesan** bila pekerjaan belum dikirim. Pengiriman langsung menggunakan antrean yang sama dan mencoba memproses pekerjaan saat itu juga. Jadwal membutuhkan eksekutor host. Jalankan `npm run jobs:dispatch` atau pasang jadwal host sesuai [aktivasi default](aktivasi-default.md#6-siapkan-pekerjaan-host).
4. Gunakan **Coba lagi** bila status gagal. Ada maksimal lima percobaan per pekerjaan dan hingga 100 pekerjaan terjadwal pada satu waktu. Hasil disimpan per penerima dan satu pekerjaan hanya dapat menghasilkan satu notifikasi per akun. Penerima membuka pesan dari profil melalui **Pesan** atau dari tab **Sistem** pada notifikasi. Angka dibaca bertambah setelah penerima membuka pesan. Pengumuman umum memiliki jalur terpisah bagi pengunjung anonim dan berisi teks.
5. SMTP melayani verifikasi akun dan OTP. Pengiriman kampanye email masih di luar kemampuan panel. Riwayat pengiriman ini mengukur notifikasi website.

## Gunakan lampiran dan percakapan dukungan

Untuk unggahan TXT dan CSV, pilih UTF-8. CSV memakai koma, jumlah kolom konsisten, dan sel tanpa formula. PDF diperiksa tanda struktur berkas. PDF, TXT dan CSV dikirim sebagai unduhan, dengan nama yang dinormalkan. JPG, PNG dan WebP dikonversi menjadi WebP. Untuk publikasi konten, pilih visibilitas publik saat revisi terbit. Lampiran pesan privat hanya dapat diakses admin dan penerima yang benar-benar mendapat pesan. Lampiran yang masih dirujuk revisi atau riwayat pesan tetap terlindungi. Untuk mengganti lampiran aktif pada konten, simpan revisi baru.

Pada **Asisten & Respons Otomatis**, pilih status manual atau jadwal mingguan. Zona waktu memakai nama IANA seperti `Asia/Jakarta`. Masukkan rentang seperti `Sen 09:00-17:00`. Pecah rentang lewat tengah malam menjadi dua hari, misalnya `Sen 22:00-24:00` dan `Sel 00:00-05:00`. Pengaturan manual mengesampingkan jadwal. Waktu mengacu pada konfigurasi, terlepas dari apakah browser admin terbuka.

Pengguna masuk lalu membuka **Percakapan dukungan**. FAQ kata kunci aktif didahulukan. Jika tidak cocok dan jadwal menyatakan admin tidak tersedia, percakapan pertama dapat menerima jawaban ketidakhadiran. Balasan berikutnya mengantre ke admin dan tidak memicu balasan otomatis berulang. Admin dapat membalas, mencatat internal, menyelesaikan atau membuka kembali. Catatan internal tidak tampil kepada pengguna. Laporan anonim tetap memakai jalur laporan dan aturan jawabannya sendiri.

Untuk pekerjaan host, unduhan cadangan, rollback, versi pengaturan, dan monitoring, ikuti [panduan operasi admin](operasi-admin.md).

Jika data gagal dimuat, periksa sesi dan `npm run check:ready`. Periksa `/api/health/live` dan `/api/health/ready` dari lingkungan tujuan. Kehilangan akses admin ditangani melalui kode pemulihan atau [prosedur penyerahan](penyerahan.md). Untuk gangguan database atau pergantian rilis, ikuti [prosedur pemulihan](../ops/backup-restore.md).
