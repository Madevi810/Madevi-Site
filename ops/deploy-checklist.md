# Checklist server nyata

Belum ada deployment atau layanan penyedia yang diberikan untuk Madevi. Gunakan daftar ini saat menyiapkan staging, lalu ulangi untuk produksi dengan data, origin dan kredensial berbeda. [Panduan online](../docs/online.md)

## Sebelum online

- [ ] Pilih commit/image, server, PostgreSQL, wilayah, batas biaya, dan penanggung jawab. Pilih SMTP jika pendaftaran email akan digunakan dan Google jika login sosial akan digunakan.
- [ ] Buat database serta konfigurasi terpisah, siapkan origin HTTPS dan simpan secret secara privat. Demo dimatikan di staging dan produksi.
- [ ] Periksa build, typecheck, unit/integrasi, hak akses akun, browser dan aksesibilitas. Latih migrasi dan backup/restore di database uji.
- [ ] Periksa DNS, proxy, TLS, izin database, kesesuaian port dan batas upload. Dokumentasikan pengaturan header IP jika trust diaktifkan.
- [ ] Simpan rencana rollback, konfigurasi terdahulu, lokasi backup terenkripsi dan penerima alarm. Tetapkan kapasitas dan retensi.
- [ ] Sebelum data nyata, selesaikan peninjauan keamanan, kebijakan privasi dan perlindungan anak, aksesibilitas, serta batas fitur yang disetujui pemilik.

## Sesudah online

- [ ] Dari jaringan penguji, buka origin HTTPS. Cek sertifikat, redirect yang benar, `/api/health/live`, dan `/api/health/ready`.
- [ ] Verifikasi admin non-demo dengan MFA, akses yang ditolak bagi pengguna biasa, serta pemulihan berdasarkan kode uji.
- [ ] Bila SMTP dipasang, lakukan verifikasi, perubahan email dan reset dengan alamat uji. Bila OAuth dipasang, lakukan login Google dan cek callback serta status profil.
- [ ] Uji avatar dan bukti laporan, izin media, penerbitan konten uji, log serta monitoring. Pastikan alarm uji diterima penanggung jawab dan kuota masih cukup.
- [ ] Jalankan backup, simulasikan restore ke database uji baru, dan catat waktu serta hasilnya. Cabut akses sementara yang sudah tidak dibutuhkan.
- [ ] Catat commit/image, waktu rilis, apa yang berhasil di host tujuan, dan kondisi yang memicu rollback. Tinjau hasil bersama pemilik sebelum membuka untuk pengguna nyata.
