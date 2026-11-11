# Penanganan gangguan dan insiden

Status: prosedur awal; belum diuji di staging dan belum ada pemantauan otomatis. Ade tetap pemilik/admin tunggal. Jangan menyimpan kredensial, isi pesan, foto laporan, atau data pribadi dalam tiket/log umum.

1. **Pastikan gangguan.** Catat waktu, versi aplikasi, lingkungan, gejala dan dampak; bandingkan `/api/health/live` dan `/api/health/ready`. Kedua endpoint ini tidak menjamin seluruh fitur atau email sehat.
2. **Batasi dampak secara aman.** Hentikan promosi rilis yang gagal dan batasi akses/fitur yang terdampak dengan mekanisme yang telah disetujui. Jangan menghapus data, mematikan database, atau memutus layanan secara otomatis hanya berdasarkan satu sinyal.
3. **Amankan bukti.** Batasi akses ke log, catat perubahan konfigurasi dan versi tanpa menyalin rahasia. Bila dicurigai kredensial bocor, ikuti prosedur rotasi pemilik dan cabut akses terdampak sesuai penyedia.
4. **Pulihkan.** Periksa kompatibilitas sebelum mengembalikan image aplikasi lama; uji pemulihan database menggunakan cadangan tervalidasi pada tujuan kosong terpisah terlebih dahulu. Jangan menjalankan rollback migrasi development pada produksi.
5. **Verifikasi dan tindak lanjut.** Periksa health, masuk akun uji, fungsi terdampak dan integritas data; catat durasi, penyebab, keputusan dan tindak lanjut. Notifikasi kepada pengguna atau pihak terkait bergantung kebijakan yang disetujui dan kebutuhan hukum.

Penerima alert, kontak dukungan, eskalasi, target RTO/RPO dan penanggung jawab saat Ade tidak tersedia masih belum diputuskan. Tidak ada perintah otomatis atau layanan monitoring aktif pada dokumen ini.
