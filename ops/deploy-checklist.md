# Checklist server nyata

Status: belum deploy. Jangan menerima data nyata sampai setiap kontrol yang berlaku diperiksa.

- [ ] Pilih server, PostgreSQL, domain, SMTP, lokasi data, kapasitas, biaya dan penanggung jawab.
- [ ] Buat environment staging dan produksi terpisah, URL HTTPS serta rahasia berbeda; jangan aktifkan akun demo.
- [ ] Jalankan typecheck, unit, integrasi, build, CI dan Docker, verifikasi izin, MFA, registrasi/verifikasi dan pemulihan akun pada staging.
- [ ] Konfigurasi proxy, TLS otomatis, rate limit edge dan pembatasan akses database; periksa header proxy tepercaya.
- [ ] Siapkan backup terenkripsi di lokasi terpisah, jadwal, retensi dan uji restore database kosong; siapkan rollback aplikasi.
- [ ] Aktifkan monitoring, alert dan penerimanya; tetapkan kapasitas dan uji beban sesuai target.
- [ ] Tinjau keamanan independen, privasi, aksesibilitas dan risiko fitur yang akan dibuka, termasuk anak.
- [ ] Tinjau hasil bersama pemilik sebelum penggunaan nyata.
