import { writeSync } from "node:fs";
import { authOrigin, backupSettings, configurationIssues, databaseUrl, googleSettings, smtpSettings } from "../src/lib/env.ts";
import { createSmtpTransport } from "../src/lib/mail.ts";
import { createDatabasePool } from "../src/lib/postgres.ts";
import { checkDatabaseReadiness } from "../src/lib/readiness.ts";

const issues = configurationIssues();
if (issues.length) {
  writeSync(2, ["Konfigurasi belum siap:", ...issues.map(issue => `- ${issue}`), ""].join("\n"));
  process.exitCode = 1;
} else {
  const uri = new URL(databaseUrl());
  console.log("Target PostgreSQL:", JSON.stringify({ host: uri.hostname, port: uri.port, database: uri.pathname.slice(1) }));
  console.log("Origin:", authOrigin());
  const pool = createDatabasePool(uri.href, 1);
  try {
    const readiness = await checkDatabaseReadiness(pool);
    if (readiness !== "ready") {
      process.exitCode = 1;
      console.error(readiness === "schema_pending"
        ? "Skema belum siap. Jalankan npm run db:migrate dengan role migrasi."
        : "Database belum siap. Periksa koneksi, TLS dan izin role runtime.");
    } else console.log("Database: dapat diakses dan skema Madevi tersedia.");
  } finally {
    await pool.end();
  }

  const smtp = smtpSettings();
  if (!smtp) console.log("SMTP: belum diisi. Pendaftaran email dan operasi OTP email belum aktif.");
  else {
    const transport = createSmtpTransport(smtp);
    try {
      await transport.verify();
      console.log("SMTP: koneksi dan autentikasi berhasil. Uji pengiriman masih diperlukan.");
    } catch {
      process.exitCode = 1;
      console.error("SMTP: koneksi atau autentikasi belum berhasil. Periksa host, port, TLS dan akses pengirim.");
    } finally {
      transport.close();
    }
  }

  console.log(backupSettings()
    ? "Backup: konfigurasi dasar tersedia. Verifikasi izin host dan restore sebelum mengandalkannya."
    : "Backup: konfigurasi belum diisi pada proses ini; periksa host operasi.");
  console.log(googleSettings()
    ? "Google: konfigurasi tersedia. Uji callback dan login pengguna diperlukan."
    : "Google: belum diisi (opsional).");
  console.log(process.env.TRUST_PROXY_HEADERS === "true"
    ? "Proxy: konfigurasi tersedia. Verifikasi origin tertutup dan header ditimpa pada host."
    : "Proxy: header IP klien tidak dipercaya.");
}
