# Keamanan Madevi

Madevi memakai satu admin pengendali dan akun website yang dapat mendaftar sesuai konfigurasi email. Materi ruang yang belum diisi merupakan bagian dari rencana pengembangan. Acuan perubahan ini mencakup OWASP ASVS 5 untuk autentikasi, sesi, otorisasi, penanganan berkas, komunikasi, konfigurasi, data dan audit. Bukti yang tercatat berlaku pada alur yang diuji. [OWASP ASVS](https://github.com/OWASP/ASVS)

## Batas kepercayaan dan akses

| Batas | Pengaman server | Batas verifikasi |
| --- | --- | --- |
| Browser dan reverse proxy | Mutasi memeriksa origin. Cookie sesi menggunakan pengaturan Better Auth. Forwarded IP hanya dipakai bila rahasia dan header proxy yang didukung cocok. Aplikasi memisah kuota login, pemulihan, MFA, laporan, unggahan dan operasi. | Tutup akses langsung ke origin dan batasi trafik di VPS atau edge yang dipilih. Kuota PostgreSQL bergantung pada database dan kapasitas host. |
| API akun dan objek privat | Profil dan avatar memakai akun dari sesi. Sesi dapat dicabut oleh akun yang sama. Notifikasi, percakapan dan media privat memeriksa penerima/pemilik pada query. Draf, revisi, bukti laporan dan backup memerlukan izin yang sesuai. | ID atau kursor dari browser tidak memberi hak. Respons privat memakai `no-store`. [Kontrak API](api.md) |
| API autentikasi | Daftar endpoint yang diizinkan membatasi permukaan Better Auth. Pengelola masuk dengan kata sandi dan TOTP atau kode cadangan sekali pakai. Endpoint mentah untuk membaca ulang seed, pengaitan OAuth pengelola, dan pemulihan email pengelola ditolak. | Pertahankan TOTP dan kode cadangan sebagai jalur aplikasi. Penggantian faktor admin yang sudah aktif memakai prosedur host. |
| Runtime dan PostgreSQL | Role migrasi memiliki skema. Runtime dapat menulis data yang dibutuhkan aplikasi, membaca dan menambah audit. Runtime ditolak untuk mengubah skema, menetapkan peran, menghapus akun atau menulis status hasil host. | Pemilik database dan operator migrasi memiliki kewenangan tinggi. Audit dalam database yang sama membantu penelusuran; salinan audit terpisah diperlukan bila model ancaman mencakup operator database. [Template hak](../database/roles.example.sql) |
| Web dan operasi host | Proses web tidak memegang soket Docker atau kunci backup. Worker mengambil operasi yang telah ditentukan, memeriksa peminta dan target, mencatat hasil, dan menolak restore atau perpindahan rilis jika sesi asal telah berakhir. | Keanggotaan grup Docker memberi kewenangan setara administrator host. Berikan melalui override khusus instance operasi jika rollback diaktifkan. [Operasi host](../ops/systemd/README.md) |

## Sesi dan konfirmasi tindakan

| Akun | Masa berlaku maksimum | Batas tidak aktif |
| --- | --- | --- |
| Admin dan peran pengelola | 8 jam sejak sesi dibuat | 30 menit |
| Pengguna biasa | 7 hari sejak sesi dibuat | 24 jam |

Interaksi keyboard atau penunjuk dari tab aktif memperbarui waktu aktivitas, paling sering sekali per menit. Polling, fokus tab, refresh sesi Better Auth dan akses GET berjalan tanpa memperpanjang batas. Akses server diperiksa terhadap waktu PostgreSQL. Migrasi memakai waktu pembuatan sebagai awal aktivitas bagi sesi lama sehingga sesi yang sudah melewati batas perlu masuk ulang. **Kelola sesi masuk** menampilkan waktu pembuatan, aktivitas dan akhir masa berlaku. Untuk sesi yang sedang digunakan, pilih **Keluar**.

Akun Google tanpa kata sandi dapat menyiapkan kata sandi melalui OTP alamat lama saat layanan email aktif. Perubahan kata sandi memeriksa kata sandi saat ini melalui Better Auth. Perubahan email memerlukan kata sandi, lalu OTP untuk alamat baru pada akun, sesi dan target yang sama. Bukti server berlaku 10 menit. Perubahan email atau kata sandi mencabut semua sesi melalui transaksi database. Perubahan identitas dan regenerasi kode cadangan admin memerlukan MFA yang baru dibuktikan dalam lima menit. Regenerasi membatalkan kode lama dan mencabut sesi lain. Kata sandi konfirmasi operasi host diperiksa dalam permintaan yang berisi jenis operasi dan target. Worker memeriksa sesi MFA asal untuk restore, perubahan image dan profil.

Dokumen PDF, TXT dan CSV diproses dengan batas ukuran, tipe dan pemeriksaan struktur. Sebelum dapat dilampirkan ke publikasi, dokumen publik memerlukan tinjauan manual sumber dan isi yang dicatat pada server. Dokumen publik lama yang belum ditinjau dapat disahkan dari pustaka admin. Browser mengunduh dokumen sebagai lampiran. Pemeriksaan ini belum mencakup deteksi malware. Bila kebijakan pemilik mensyaratkan pemindai, lakukan pemeriksaan dari mesin operator sebelum menyetujui dokumen.

## Pemulihan admin tunggal

Jika autentikator hilang, masuk dengan kata sandi dan satu kode cadangan. Buat ulang kode cadangan jika diduga bocor. Bila faktor dan kode tidak tersedia atau email tidak dapat diakses, gunakan akses host dan role migrasi yang sudah dikuasai pemilik. Akses itu merupakan bukti operasional lewat penyedia, SSH dan database. Pengguna website tidak memiliki endpoint pemulihan admin.

1. Verifikasi identitas pemilik serta target dari inventaris penyedia, pilih database yang benar, lalu jadwalkan jendela pemeliharaan. Isolasi trafik web dan hentikan worker operasi. Simpan bukti insiden dan salinan backup terenkripsi sebelum perubahan.
2. Siapkan checkout tepercaya pada versi yang sesuai skema. Muat `DATABASE_URL` untuk role pemilik tabel migrasi dan `OWNER_RECOVERY_PASSWORD` dari berkas privat di luar checkout. Kata sandi baru harus 12–128 karakter. Dari root gunakan `node --env-file=/lokasi-privat/recovery.env scripts/recover-owner.mjs --confirm-owner=USERNAME_ADMIN`. Sesuaikan placeholder username dengan akun admin yang sudah ada.
3. Skrip mencocokkan satu admin yang sama, mengganti hash menggunakan Better Auth, mencabut sesi serta data faktor dan tantangan lama, dan menambah audit. Skrip lalu mewajibkan pendaftaran TOTP sebelum admin dapat membuka panel. Akun dan peran tetap satu. Bila skrip menolak, periksa kepemilikan tabel atau target secara privat. Simpan catatan operator dan waktu pemulihan.
4. Dalam akses terbatas, masuk dengan kata sandi baru, daftarkan TOTP dan simpan kode cadangan secara privat. Uji bahwa sesi lama ditolak, akun lain masih berfungsi dan audit tampil. Hapus berkas pemulihan sementara sesuai prosedur rahasia, lalu jalankan kembali trafik dan worker setelah diperiksa. [Respons insiden](../ops/incident-response.md)

## Inventaris rahasia dan penggantian

| Konfigurasi | Sumber dan pemakai | Dampak dan pemulihan |
| --- | --- | --- |
| `DATABASE_URL` | Role dan endpoint dari penyedia PostgreSQL. Web dan dispatcher memakai runtime. Migrasi, bootstrap dan pemulihan memakai pemilik skema. Worker operasi memakai kredensial operasi tersendiri dari environment host. | Terapkan hak setelah migrasi. Saat mengganti sandi koneksi, mulai ulang proses yang membacanya. Batasi role lama setelah staging dan koneksi baru teruji. |
| `MADEVI_BACKUP_DATABASE_URL`, `MADEVI_RESTORE_DATABASE_URL`, `MADEVI_MAINTENANCE_DATABASE_URL` | Host memakai role baca backup, koneksi target kosong, dan role retensi dengan izin terbatas. Mode `prune` memerlukan URI pemeliharaan yang berbeda role dan menuju database yang sama. | Tes restore hanya ke target kosong terpisah. Tanpa URI retensi, gunakan `dry-run`. Simpan URI restore sementara dan cabut akses setelah tugas. |
| `BETTER_AUTH_SECRET` | Rahasia acak dari pengelola secret, minimal 32 karakter. Better Auth, cookie dan limiter memakainya. | Pergantian memengaruhi sesi, OTP dan material faktor yang terenkripsi. Jadwalkan pendaftaran ulang faktor admin melalui prosedur host bila kunci sekarang tidak dapat membuka faktor lama. Simpan kunci terdahulu secara privat selama diperlukan untuk pemulihan lingkungan lama. |
| `MADEVI_PROXY_SECRET` | Rahasia acak tersendiri dengan nilai sama pada reverse proxy dan web saat `TRUST_PROXY_HEADERS=true`. | Perbarui kedua sisi pada jendela pemeliharaan. Verifikasi bahwa origin tetap tertutup dan proxy menimpa header. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Dashboard penyedia SMTP dan alamat pengirim terverifikasi. Web mengirim verifikasi dan OTP. Alarm host memakai konfigurasi SMTP yang sama bila `MADEVI_ALERT_TO` diisi. | Uji host, TLS dan pengirim lalu cabut kredensial lama. Tanpa SMTP, verifikasi email dan alarm email tidak aktif. Tujuan alarm kosong menonaktifkannya. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client milik pemilik. Pakai redirect URI yang sesuai origin. Opsional bagi pengguna biasa. | Uji pengaitan akun biasa di staging dan cabut client lama setelah migrasi yang disetujui. |
| `MADEVI_BACKUP_KEY` | 32 byte acak dalam 64 karakter heksadesimal pada host backup. Simpan terpisah dari arsip. | Catat generasi kunci untuk tiap kelompok arsip. Simpan arsip di luar host. Untuk verifikasi atau restore arsip lama, gunakan sesi operator terisolasi dengan kunci generasi itu dan target kosong. Pengujian salah kunci wajib menolak arsip. [Prosedur backup](../ops/backup-restore.md) |
| `OWNER_PASSWORD`, `OWNER_RECOVERY_PASSWORD` | Masukan sementara dari penyimpanan privat untuk bootstrap/pemulihan pada host. | Bersihkan setelah proses, jangan teruskan ke container web. Pemulihan mencabut sesi dan membutuhkan enrollment baru. |

Simpan secret dari pengelola yang dikendalikan pemilik atau berkas operator mode `0600` di luar checkout. Pastikan hanya proses yang sesuai memperoleh nilainya. Pakai pemeriksaan staging dengan fixture sebelum mengganti nilai nyata. Layanan dan kredensial masih kosong sampai pemilik menyediakan akses. [Aktivasi](aktivasi-default.md), [peta layanan](ganti-layanan.md)

## CI, container dan edge

CI membatasi izin GitHub ke pembacaan konten, memakai SHA penuh untuk Action yang dipakai langsung, dan memakai PostgreSQL, Chromium serta SMTP sintetis. Pemeriksaan pola secret, aturan Semgrep yang dipelihara sendiri, `npm audit`, dan Trivy dengan image pemindai yang dipin ke digest resmi bertujuan menemukan kategori yang didukung masing-masing alat. Saat hasil muncul, periksa paket, jalur penggunaan, kondisi aktivasi dan versi perbaikan sebelum memutuskan perubahan. Pemilik dapat mengaktifkan proteksi branch, pemeriksaan wajib, review perubahan workflow dan pembatasan penulis release melalui pengaturan GitHub.

Container web berjalan sebagai non-root, filesystem baca-saja dengan tmpfs terbatas, tanpa Linux capability dan tanpa soket Docker. Image runtime menyertakan Node dan dependensi produksi. Jalankan migrasi dan bootstrap di container memakai skrip Node; npm tersedia pada checkout host. Batasi akses jaringan ke 443 pada proxy, tutup port aplikasi dari luar, dan batasi akses PostgreSQL ke jaringan aplikasi dan operator. Pantau kapasitas serta batas koneksi/body pada tepi sesuai konfigurasi VPS. Aplikasi membatasi envelope unggahan sampai 2,2 MB, jenis dan piksel gambar, serta jumlah pekerjaan dan unduhan backup bersamaan. Jika terjadi banjir, gunakan kendali jaringan/edge yang disediakan operator. [Proxy](../ops/reverse-proxy.example.md)

[Hasil pengujian dan cakupan](laporan-keamanan.md)
