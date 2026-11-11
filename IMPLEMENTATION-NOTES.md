# Catatan implementasi dan penyerahan

- Status: pekerjaan pondasi awal, belum siap produksi dan belum diterbitkan.
- Stack aktual: Next.js 16.4.5, React 19.3.1, TypeScript 7.0.2, Node 24 LTS, PostgreSQL via pg, Better Auth 1.7.17. Versi lain tertera di package-lock.json.
- Akun tunggal seluruh ruang; hanya admin tunggal. Pengecualian demo berhenti di development; admin non-demo memerlukan MFA untuk mengakses data admin.
- Google dikonfigurasi opsional tetapi belum diuji dengan penyedia; sign-in menggunakan nomor telepon belum diterapkan; pengujian memakai PGlite dan PostgreSQL server terpisah pada lingkungan lokal.
- Foto profil disimpan dalam database sebagai gambar WebP hasil pemrosesan. Infrastruktur penyimpanan media skala besar belum dipilih.
- Ada uji pemulihan fisik lokal; belum ada backup otomatis, uji restore pg_dump/pg_restore, observabilitas nyata, sistem notifikasi, moderasi sosial, kapasitas trafik terukur, atau uji keamanan independen.
- Fitur konten dan taksonomi ruang ditunda; tidak ada data riil dalam implementasi atau arsip.
- Versi produk sekarang 0.0.0.4; nomor npm 0.0.0-4 adalah representasi teknis yang valid dalam format package npm, bukan penomoran tampilan Madevi.

- Tailwind disiapkan sebagai dasar; banyak class CSS lama masih digunakan. Deploy, Docker/CI nyata dan penyedia belum diuji.

- Pengelolaan konten dan halaman baca masih terbatas pada teks sederhana; editor, media isi, pencarian lengkap, dan UI seluruh ruang belum selesai.
