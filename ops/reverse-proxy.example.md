# Contoh reverse proxy Caddy

Ini contoh belum diaktifkan. Siapkan DNS dan domain milik Ade, pastikan port 80/443 tersedia, serta aktifkan HTTPS dan perpanjangan sertifikat pada server. Ganti `madevi.example.invalid` sebelum dipakai.

```caddyfile
madevi.example.invalid {
    request_body {
        max_size 2MB
    }
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```

Pakai `TRUST_PROXY_HEADERS=true` hanya bila proxy ini satu-satunya jalur masuk ke aplikasi dan `X-Real-IP` ditimpa proxy terpercaya. Verifikasi topologi dan alamat klien jika ada CDN atau proxy lain di depannya. Terapkan pembatasan request dan perlindungan tepi sesuai provider; cek jenis/ukuran upload yang benar sebelum menetapkan batas final.
