# Contoh reverse proxy Caddy

Gunakan Caddy 2.10 atau lebih baru. Ganti `madevi.example.invalid` dengan host HTTPS yang dipilih. Arahkan DNS, buka port 80/443 dan ikat port Compose hanya ke `127.0.0.1`. Di staging, ubah port upstream jika override menjalankan aplikasi pada port lain.

Buat `MADEVI_PROXY_SECRET` yang berbeda dari secret autentikasi, minimal 32 karakter. Pasang nilai yang sama di environment privat Caddy dan aplikasi. Kuasai siapa yang dapat mengakses file layanan, dan hindari menyalin header rahasia ke access log atau keluaran adaptasi Caddy.

```caddyfile
madevi.example.invalid {
	request_body {
		max_size 2200000
	}
	reverse_proxy 127.0.0.1:3000 {
		header_up X-Real-IP {remote_host}
		header_up X-Madevi-Proxy-Token {$MADEVI_PROXY_SECRET}
		transport http {
			dial_timeout 3s
			response_header_timeout 30s
		}
	}
}
```

Jalankan `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` dengan environment Caddy yang sama. Berkas bukti dapat berukuran sampai 2.000.000 byte. Batas body mengizinkan boundary multipart dan field formulir.

Aktifkan `TRUST_PROXY_HEADERS=true` hanya setelah akses langsung ke origin ditutup dan Caddy menimpa kedua header pada konfigurasi di atas. Aplikasi memeriksa token proxy dan format IP. Jika ada CDN atau proxy di depan Caddy, verifikasi header dan hop tepercaya bersama operator sebelum menggunakan atribusi IP klien. Uji IP dan cookie limiter, batas upload, timeout serta HTTPS di staging.

Referensi diperiksa 25 November 2026. [Reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [batas body](https://caddyserver.com/docs/caddyfile/directives/request_body)
