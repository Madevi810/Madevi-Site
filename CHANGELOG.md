# v0.0.0.15 — ketahanan pengaturan profil, WARNING

- Tampilkan kesalahan saat pemuatan profil gagal atau koneksi terputus ketika menyimpan profil dan foto.

# v0.0.0.14 — penguatan tes browser, WARNING

- Perbaiki selector tes browser dan verifikasi isi foto profil berubah saat diganti.
- Belum siap pengguna nyata; layanan dan uji lingkungan tujuan masih diperlukan.

# v0.0.0.13 — penerapan tata letak Default, WARNING

- Terapkan susunan beranda, sidebar, profil dan dashboard admin yang telah ditinjau di site audit; pertahankan tema dan efek project.
- Satukan tambah, ubah, dan hapus foto di menu ikon pensil pada avatar pendaftaran dan pengaturan profil. Pengaturan akun tetap menggunakan API aplikasi, bukan data contoh site.
- Admin menampilkan kartu menuju pengelolaan pengguna, laporan, konten dan sistem; indikator yang belum tersedia tidak dibuat-buat.
- Uji unit, tipe, build dan integrasi PostgreSQL lokal dilaksanakan. Uji browser aplikasi terhalang; rincian pada Verification-Stage-5 di Pondasi.

---

# v0.0.0.12 — interaksi dan pengujian lokal, WARNING

- Muat notifikasi Umum, Sistem dan Sosial per kategori, dengan halaman lanjutan dan pembatasan akses pada notifikasi pribadi.
- Perbaiki navigasi keyboard tab dan dialog, tombol lihat kata sandi, validasi pendaftaran dan keadaan gagal memuat profil; rapikan pilihan status laporan admin.
- Tambah uji cursor, banyak notifikasi, isolasi penerima dan pemulihan admin memakai kode MFA sekali pakai.
- Perbarui site audit yang terpisah untuk pemeriksaan tampilan; site tidak terhubung ke database atau akun aplikasi.
- Layanan dan isi ruang belum diaktifkan. Demo hanya untuk development; kesiapan produksi tetap WARNING.

---

# v0.0.0.11 — pekerjaan lokal, WARNING

- Batasi runtime produksi agar wajib memilih staging atau production; validasi dan batasi ukuran data perubahan akun admin.
- Tambahkan paginasi dan pencarian akun berbasis database, pemilihan penerima melalui pencarian, paginasi laporan dan konten, serta penanganan saat data gagal dimuat.
- Popover admin memakai notifikasi API dan mengecek keberadaan laporan baru saat dibuka; ini bukan layanan alert aktif.
- Pindahkan sisa selector komponen di stylesheet global ke utility Tailwind dan token yang mempertahankan nilai sebelumnya; pemeriksaan visual belum lulus.
- Tambahkan pengaman backup lokal dan rancangan respons insiden serta klasifikasi data. pg_dump/restore nyata dan enkripsi belum diuji.
- Tidak mengaktifkan provider atau mengisi tujuh ruang; demo lokal tetap terkunci.

# v0.0.0.10 — pekerjaan lokal, WARNING

- Pisahkan cabang data contoh dan kontrol tampilan audit dari profil, notifikasi dan admin; jalur aplikasi tetap memakai API. Akun demo sementara terisolasi tetap dipertahankan.
- Migrasi gaya notifikasi, ikon sosial developer dan preview laporan ke utility Tailwind menggunakan token yang sesuai. CSS lain masih memerlukan migrasi.
- Tambahkan pemeriksaan regresi untuk pemisahan tampilan audit. Site online tidak diperbarui.
- Tidak ada aktivasi layanan, konten ruang atau persetujuan produksi. Lihat Verification-Stage-5 untuk batas dan hasil pengujian.

# v0.0.0.9 — pekerjaan lokal, WARNING

- Perketat aktivasi dan pembuatan akun demo ke konfigurasi lokal, tanpa proxy tepercaya; jalur demo tetap ada sementara sesuai keputusan Ade.
- Server development standar terikat ke 127.0.0.1; tambahkan pengujian batas dan panduan penghapusan.
- Pisahkan folder dan alat build site audit dari paket aplikasi; cabang audit dalam beberapa komponen masih perlu dipisahkan. Site online belum diperbarui.
- Catat inventaris CSS, kebutuhan layanan, keputusan dan bukti. Seluruh ruang tetap kosong.
- CI, Docker, staging, monitoring, audit independen dan pengujian di lingkungan tujuan belum terbukti.

# v0.0.0.8 — pengaturan, admin, dan notifikasi

- Menyesuaikan pelebaran search, warna, sidebar dan footer; halaman informasi masih perlu dilengkapi sebelum layanan nyata.
- Menambahkan kelompok notifikasi Umum, Sistem dan Sosial; API notifikasi umum dan pribadi serta pengiriman admin dipersiapkan pada PostgreSQL.
- Menambahkan laporan dengan tautan, foto bukti privat, status, dan batas akun/IP; menyiapkan tempat sampah konten serta menu sistem dengan status layanan yang jujur.
- Mengatur foto dan data profil, mengganti email setelah verifikasi, dan reset kata sandi dengan OTP email; privasi profil sosial disimpan tertutup secara awal.
- Tautan audit tetap privat, backend belum terhubung, dan data contoh hanya sementara di browser. Isi ruang dan layanan sosial tetap belum dibangun.

# v0.0.0.7 — penyempurnaan tampilan dan audit

- Membuat pencarian melebar, menutup popup pengaturan/notifikasi, menyelaraskan ikon developer dan menambahkan gradasi cokelat serta animasi scroll yang menghormati reduced motion.
- Pendaftaran menjadi dua langkah; kota asal wajib diperiksa server, dengan foto opsional setelah verifikasi dan masuk pada tab yang sama.
- Situs audit privat menyediakan akses User dan Admin sementara berbasis browser untuk melihat tampilan, tanpa akun atau akses database. Akses ini tidak ada pada autentikasi aplikasi utama dan harus dihapus setelah audit.
- Build, pengujian lokal dan integrasi PostgreSQL sintetis dilakukan; layanan dan akun asli pada tautan belum terhubung.

# v0.0.0.6 — tautan uji tampilan

- Menambahkan target build audit yang menggunakan komponen, tema, aset, dan daftar ruang dari source Madevi yang sama.
- Pada tautan audit, akun, laporan dan API dinonaktifkan karena PostgreSQL dan layanan nyata belum terhubung; bukan staging aplikasi penuh atau produksi.
- Setiap perubahan memerlukan build dan deploy ulang untuk memperbarui tautan.

# v0.0.0.5 — pematangan sistem berlanjut

- Fase 1: migrasi selector komponen lama ke utility Tailwind dan token selesai; pemeriksaan browser dan inventaris dicatat di Pondasi.
- Fase 2: menambah salinan rujukan migrasi yang diuji kesamaannya, contoh fixture sintetis, dan prosedur backup terpisah; tidak ada database atau backup nyata dalam paket.
- Memperbaiki ikon header admin yang terpotong di ponsel dan ketahanan pilihan tema/bahasa saat navigasi.
- Typecheck, tujuh tes unit, build dan integrasi lokal sintetis diperiksa; belum ada staging, CI GitHub Actions, Docker atau layanan nyata.

# v0.0.0.4 — pematangan sistem sedang berlangsung

- Fase 1: sebagian komponen dipindahkan ke utility Tailwind dan inventaris selector dicatat; migrasi seluruh tampilan belum selesai.
- Menghubungkan pencarian publik ke judul konten terbit dan menambahkan halaman baca sederhana untuk blok teks. Data nyata tidak disertakan.
- Menambah pengelolaan draf teks dasar di admin dan pemeriksaan status koneksi database pada dashboard.
- Memperketat pengaman rollback database uji, memperluas pemeriksaan reset kata sandi menggunakan SMTP palsu, dan mempertahankan tema pada halaman masuk admin.
- Menghapus font yang tidak digunakan dari salinan paket. CI/Docker/staging dan kesiapan pengguna nyata belum terbukti.

# v0.0.0.3 — penyiapan project untuk server nyata

- Project Madevi dipisah dari dokumen Pondasi; lokasi CI diperbaiki untuk repository Madevi sebagai akar.
- Contoh Compose, proxy dan checklist server, satu sumber migrasi, serta slot konfigurasi tambahan.
- Dasar Tailwind dan token ditambahkan; migrasi komponen dan uji menyeluruh masih berlangsung.
- PostgreSQL, SMTP, OAuth, hosting, monitoring dan backup nyata belum diaktifkan. Tidak siap produksi.

# v0.0.0.2 — pematangan pondasi

- Kerangka data dan API generik, revisi, alur tinjau-terbit, kontrol izin, dan migrasi.
- Adaptor media/pencarian/cache; konfigurasi, CSP, rate limit, health, log keamanan, dan rencana operasi.
- Contoh CI/container serta pengujian integrasi, PostgreSQL, pemulihan fisik lokal, dan aksesibilitas terbatas.
- Ruang tetap kosong; belum ada deployment dan status tetap belum siap produksi.

# Perubahan Madevi

## v0.0.0.1 — implementasi pondasi awal

- Kerangka tujuh ruang kosong, navigasi, pencarian kosong, tema, profil dan halaman admin.
- Integrasi PostgreSQL dan Better Auth, migrasi, akun demo yang dibatasi untuk development, verifikasi email saat SMTP dikonfigurasi, autentikator admin, serta laporan dan foto profil.
- Pemeriksaan awal tipe, build, audit dependensi dan pengujian lokal. Lihat README untuk batas dan kebutuhan yang belum diuji.

Penomoran berikutnya menaikkan angka terakhir satu tingkat per pembaruan, sesuai keputusan Ade.

