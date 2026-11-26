import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { configurationIssues, databaseUrl, googleSettings, smtpSettings } from "../src/lib/env.ts";
import { browserRateId, issueRateCookie, rateCookieAge, trustedClientIp } from "../src/lib/rate-identity.ts";

test("check:ready refuses absent or partial integrations with value-free diagnostics", () => {
  const environment = {
    PATH: process.env.PATH,
    SMTP_HOST: "confidential-mailhost.invalid",
    GOOGLE_CLIENT_SECRET: "confidential-google-value",
  };
  const result = spawnSync(process.execPath, ["scripts/check-ready.mjs"], {
    env: environment, encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL belum dikonfigurasi/);
  assert.match(result.stderr, /SMTP harus lengkap/);
  assert.match(result.stderr, /Google harus lengkap/);
  assert.doesNotMatch(result.stderr + result.stdout, /confidential-/);
});

test("config keeps optional providers off and rejects unverified proxy settings", () => {
  assert.equal(smtpSettings({}), null);
  assert.equal(googleSettings({}), null);
  assert.throws(() => databaseUrl({ DATABASE_URL: "postgresql://127.0.0.1/test?host=other.invalid" }));
  assert.throws(() => databaseUrl({ MADEVI_ENV: "production", DATABASE_URL: "postgresql://db.example.invalid/test?sslmode=verify-full&sslmode=disable" }), /verify-full/);
  assert.ok(configurationIssues({ TRUST_PROXY_HEADERS: "true" }).some(issue => issue.includes("MADEVI_PROXY_SECRET")));
  const settings = { MADEVI_ENV: "staging", SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "2525", SMTP_USER: "user", SMTP_PASS: "test", MAIL_FROM: "test@example.invalid" };
  assert.equal(smtpSettings(settings)?.requireTLS, true);
  assert.equal(smtpSettings({ ...settings, SMTP_PORT: "465" })?.secure, true);
});

test("rate limiting accepts IP only from an authenticated proxy and canonicalizes IPv6", () => {
  const headers = new Headers({ "x-real-ip": "::ffff:192.0.2.5" });
  const env = { TRUST_PROXY_HEADERS: "true", MADEVI_PROXY_SECRET: "x".repeat(32) };
  assert.equal(trustedClientIp(headers, env), null);
  headers.set("x-madevi-proxy-token", env.MADEVI_PROXY_SECRET);
  assert.equal(trustedClientIp(headers, env), "192.0.2.5");
  assert.equal(trustedClientIp(headers, { ...env, TRUST_PROXY_HEADERS: "false" }), null);
  headers.set("x-real-ip", "2001:0DB8:0000:0000::0001");
  assert.equal(trustedClientIp(headers, env), "2001:db8::1");
  headers.set("x-real-ip", "192.0.2.5, 192.0.2.6");
  assert.equal(trustedClientIp(headers, env), null);
});

test("browser budget identifiers must be issued by the server and expire", () => {
  const now = 1_795_608_000_000;
  const first = issueRateCookie(now);
  const second = issueRateCookie(now);
  assert.notEqual(browserRateId(first, now), browserRateId(second, now));
  const forged = (first[0] === "0" ? "1" : "0") + first.slice(1);
  assert.equal(browserRateId(forged, now), null);
  assert.equal(browserRateId(first, now + rateCookieAge * 1000), null);
});
