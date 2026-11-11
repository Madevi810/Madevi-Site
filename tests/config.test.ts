import test from "node:test";
import assert from "node:assert/strict";
import { isDemoAllowed, emailConfigured } from "../src/lib/config.ts";

test("demo access requires explicit development environment and flag", () => {
  const local = { MADEVI_ENV: "dev", MADEVI_DEMO_MODE: "true", NODE_ENV: "development", DATABASE_URL: "postgresql://localhost/madevi_test", BETTER_AUTH_URL: "http://localhost:3000" };
  assert.equal(isDemoAllowed({}), false);
  assert.equal(isDemoAllowed(local), true);
  assert.equal(isDemoAllowed({...local, MADEVI_ENV: "production"}), false);
  assert.equal(isDemoAllowed({...local, NODE_ENV: "production"}), false);
  assert.equal(isDemoAllowed({...local, MADEVI_DEMO_MODE: "false"}), false);
  assert.equal(isDemoAllowed({...local, DATABASE_URL: "postgresql://remote.example/db"}), false);
  assert.equal(isDemoAllowed({...local, DATABASE_URL: "postgresql://localhost/db?host=remote.example"}), false);
  assert.equal(isDemoAllowed({...local, BETTER_AUTH_URL: "https://example.com"}), false);
  assert.equal(isDemoAllowed({...local, TRUST_PROXY_HEADERS: "true"}), false);
  assert.equal(isDemoAllowed({...local, DATABASE_URL: "postgresql://[::1]/db", BETTER_AUTH_URL: "http://[::1]:3000"}), true);
});
test("registration email requires complete configuration", () => {
  assert.equal(emailConfigured({}), false);
  assert.equal(emailConfigured({ SMTP_HOST: "host", SMTP_PORT: "587", SMTP_USER: "user", SMTP_PASS: "pass" }), false);
  assert.equal(emailConfigured({ SMTP_HOST: "host", SMTP_PORT: "587", SMTP_USER: "user", SMTP_PASS: "pass", MAIL_FROM: "test@example.invalid" }), true);
});
