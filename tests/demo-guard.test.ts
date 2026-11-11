import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// No network access is expected: invalid environments must be refused before a pool is created.
test("demo seed refuses non-local or production environments before connecting", () => {
  const base = { PATH: process.env.PATH, NODE_ENV: "development", MADEVI_ENV: "dev", MADEVI_DEMO_MODE: "true", BETTER_AUTH_URL: "http://localhost:3000", DATABASE_URL: "postgresql://localhost/test", DEMO_PASSWORD: "temporary-test-value" };
  for (const override of [
    { DATABASE_URL: "postgresql://remote.example/test" },
    { DATABASE_URL: "postgresql://localhost/test?host=remote.example" },
    { BETTER_AUTH_URL: "https://remote.example" },
    { MADEVI_ENV: "staging" },
    { NODE_ENV: "production" },
    { TRUST_PROXY_HEADERS: "true" },
  ]) {
    const result = spawnSync(process.execPath, ["scripts/seed-demo.mjs"], { encoding: "utf8", env: { ...base, ...override }, timeout: 5000 });
    assert.equal(result.status, 1, `seed should refuse ${Object.keys(override)[0]}`);
    assert.match(result.stderr, /Akun demo hanya dapat dibuat/);
  }
});
