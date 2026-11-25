# Contoh reverse proxy Caddy

Ini contoh belum diaktifkan. Siapkan DNS dan domain milik Ade, pastikan port 80/443 tersedia, serta aktifkan HTTPS dan perpanjangan sertifikat pada server. Ganti `madevi.example.invalid` sebelum dipakai. Gunakan Caddy 2.10 atau lebih baru yang mendukung `request_body`. [Dokumentasi Caddy](https://caddyserver.com/docs/caddyfile/directives/request_body)

```caddyfile
madevi.example.invalid {
	request_body {
		max_size 2200000
	}
	reverse_proxy 127.0.0.1:3000 {
		header_up X-Real-IP {remote_host}
	}
}
```

Pakai `TRUST_PROXY_HEADERS=true` hanya bila proxy ini satu-satunya jalur masuk ke aplikasi dan `X-Real-IP` ditimpa proxy terpercaya. Verifikasi topologi dan alamat klien jika ada CDN atau proxy lain di depannya. Contoh membatasi body di 2.200.000 byte, sesuai batas multipart laporan. Berkas bukti dapat berukuran sampai 2.000.000 byte dan body juga memuat boundary serta field formulir. Terapkan perlindungan tepi sesuai provider dan uji ukuran unggahan dari browser.
