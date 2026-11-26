import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

export async function smokeBuiltApplication(env, db, exerciseOutage) {
  const origin = "http://127.0.0.1:3000";
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], {
    env: {
      ...env, NODE_ENV: "production", MADEVI_ENV: "staging", MADEVI_DEMO_MODE: "false",
      BETTER_AUTH_URL: "https://localhost", SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASS: "", MAIL_FROM: "",
    },
    stdio: "inherit",
  });
  const response = path => fetch(origin + path, { signal: AbortSignal.timeout(4000) });
  try {
    let ready = false;
    for (let tries = 0; tries < 30 && app.exitCode === null; tries++) {
      ready = (await response("/api/health/ready").catch(() => null))?.ok;
      if (ready) break;
      await delay(1000);
    }
    assert.ok(ready, "built runtime readiness");
    assert.match(await (await response("/")).text(), /Ruang untuk/);
    const featureFlags = await (await response("/api/features")).json();
    assert.deepEqual(featureFlags, { google: false, email: false }, "missing providers remain visibly disabled");
    for (const path of ["/api/register", "/api/auth/email-otp/request-password-reset"]) {
      const disabled = await fetch(origin + path, {
        method: "POST", headers: { origin: "https://localhost", "content-type": "application/json" }, body: "{}",
      });
      assert.equal(disabled.status, 503, "unconfigured email operation");
    }
    assert.equal((await response("/api/admin/users")).status, 403);
    if (exerciseOutage) {
      await db.exec("ALTER TABLE madevi_schema_migrations RENAME TO madevi_qa_migrations_hidden");
      try {
        assert.equal((await response("/api/health/live")).status, 200);
        const degraded = await response("/api/health/ready");
        assert.equal(degraded.status, 503);
        assert.equal((await degraded.json()).reason, "schema_pending");
      } finally {
        await db.exec("ALTER TABLE madevi_qa_migrations_hidden RENAME TO madevi_schema_migrations");
      }
      assert.equal((await response("/api/health/ready")).status, 200);
    }
    console.log("Lulus: smoke next start, layanan opsional kosong, probe dan kontrol akses.");
  } finally {
    if (app.exitCode === null && app.signalCode === null) {
      const done = once(app, "close");
      app.kill("SIGTERM");
      await done;
    }
  }
}

export async function verifySessionAndProviderPolicy(run, env) {
  const child = `
    import assert from "node:assert/strict";
    import { assertGoogleAccountAllowed } from "./src/lib/auth-policy.ts";
    import { pool } from "./src/lib/db.ts";
    try {
      await assert.rejects(() => assertGoogleAccountAllowed({sub:"qa-unlinked", email:"MADEVI-ADMIN@example.invalid"}), /kata sandi dan autentikator/);
      assert.deepEqual(await assertGoogleAccountAllowed({sub:"qa-regular",email:"madevi-user@example.invalid"}), {});
      const created = await pool.query(\`INSERT INTO "account" (id,"userId","accountId","providerId","createdAt","updatedAt")
            SELECT 'qa-existing-google-link',id,'qa-owner-subject','google',now(),now() FROM "user" WHERE username='madevi-admin'\`);
      assert.equal(created.rowCount, 1);
      try {
        await assert.rejects(() => assertGoogleAccountAllowed({sub:"qa-owner-subject",email:"old-alias@example.invalid"}), /kata sandi dan autentikator/);
      } finally {
        await pool.query("DELETE FROM account WHERE id='qa-existing-google-link'");
      }
    } finally { await pool.end(); }
  `;
  await run(["--input-type=module", "-e", child], env);
}

export async function verifyRateIsolation(origin, db, password) {
  await db.exec("DELETE FROM madevi_rate_limits");
  const issuedCookie = async () => {
    const response = await fetch(origin);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith("madevi_rate="));
    assert.ok(cookie);
    return cookie.split(";")[0];
  };
  const first = await issuedCookie();
  const second = await issuedCookie();
  const third = await issuedCookie();
  const login = (kind, identity, cookie, forwardedIp, suppliedPassword = "synthetic-wrong-password") =>
    fetch(`${origin}/api/auth/sign-in/${kind}`, {
      method: "POST", headers: { origin, cookie, "x-real-ip": forwardedIp, "content-type": "application/json" },
      body: JSON.stringify({ [kind]: identity, password: suppliedPassword }),
    });

  // Email and username aliases resolve to the same account quota.
  for (let i = 0; i < 12; i++) {
    const kind = i % 2 ? "email" : "username";
    const identity = kind === "email" ? "madevi-user@example.invalid" : "madevi-user";
    const response = await login(kind, identity, i < 6 ? first : second, `192.0.2.${i + 1}`);
    assert.equal(response.status, 401, "synthetic invalid credential");
  }
  assert.equal((await login("username", "madevi-user", third, "198.51.100.1")).status, 429);
  const otherAccount = await login("username", "madevi-admin", third, "198.51.100.2", password);
  assert.equal(otherAccount.status, 200, "another account can still start its login");

  await db.exec("DELETE FROM madevi_rate_limits");
  for (let i = 0; i < 20; i++) {
    const response = await login("username", `qa-unknown-${i}`, first, `192.0.2.${i + 1}`);
    assert.notEqual(response.status, 200);
    assert.notEqual(response.status, 429);
  }
  const limited = await login("username", "qa-other-name", first, "203.0.113.2");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.notEqual((await login("username", "qa-other-name", second, "203.0.113.2")).status, 429);
  console.log("Lulus: batas per akun lintas alias, pemisahan browser, dan header IP langsung diabaikan.");
}

export async function verifyUnavailableDatabase(env) {
  // Known closed local TCP port. The check must fail without revealing URI credentials.
  const child = spawn(process.execPath, ["scripts/check-ready.mjs"], {
    env: { ...env, DATABASE_URL: "postgresql://local-only:sentinel-password@127.0.0.1:1/madevi_ci_unavailable",
      SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASS: "", MAIL_FROM: "", MADEVI_DEMO_MODE: "false" },
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const [code] = await once(child, "close");
  assert.equal(code, 1);
  assert.match(output, /Database belum siap/);
  assert.doesNotMatch(output, /sentinel-password|postgresql:\/\//);
}
