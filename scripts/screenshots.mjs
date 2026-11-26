import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer as createSocket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { Pool } from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const loopback = "127.0.0.1";
const imageNames = [
  "beranda-desktop.png", "beranda-ponsel.png", "sidebar.png", "profil.png", "admin.png",
];

async function listen(server) {
  server.listen(0, loopback);
  await once(server, "listening");
  return server.address().port;
}

function start(args, directory, env) {
  return spawn(process.execPath, args, { cwd: directory, env, stdio: "inherit", signal: AbortSignal.timeout(180000) })
    .on("error", error => console.error(error.message));
}

async function run(args, directory, env) {
  const [code] = await once(start(args, directory, env), "close");
  assert.equal(code, 0, `Gagal menjalankan ${args[0]}`);
}

async function waitForApp(origin, app) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (app.exitCode !== null || app.signalCode !== null) break;
    const response = await fetch(`${origin}/api/health/ready`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (response?.ok) return;
    await delay(1000);
  }
  throw new Error("Aplikasi lokal belum siap. Periksa log Next.js dan izin port loopback.");
}

async function openPage(browser, origin, viewport, mobile = false) {
  const context = await browser.newContext({
    viewport, isMobile: mobile, hasTouch: mobile,
    colorScheme: "light", reducedMotion: "reduce", locale: "id-ID", timezoneId: "Asia/Jakarta",
    deviceScaleFactor: 1, serviceWorkers: "block",
  });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  return page;
}

async function capture(page, directory, filename) {
  await page.mouse.move(0, 0);
  // The profile initially requests an avatar and then renders its placeholder on 404.
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (![...document.fonts].some(font => font.family === "NotoSans" && font.status === "loaded")) {
      throw new Error("Font Noto Sans belum dimuat.");
    }
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await page.screenshot({ path: join(directory, filename), animations: "disabled", caret: "hide" });
}

async function signIn(page, username, password) {
  await page.locator('input[name="identity"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  const login = page.waitForResponse(response =>
    response.url().endsWith("/api/auth/sign-in/username") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Masuk", exact: true }).last().click();
  assert.equal((await login).status(), 200, `Login lokal gagal untuk ${username}`);
}

function authenticatorCode(secret) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits=[...secret].map(char=>alphabet.indexOf(char).toString(2).padStart(5,"0")).join("");
  const key=Buffer.from(bits.match(/.{8}/g).map(byte=>parseInt(byte,2)));
  const counter=Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",key).update(counter).digest();
  return String((digest.readUInt32BE(digest.at(-1)&15)&0x7fffffff)%1000000).padStart(6,"0");
}

const url = new URL(process.env.MADEVI_TEST_DATABASE_URL ?? "postgresql://localhost/");
if (!["postgres:","postgresql:"].includes(url.protocol) || !["127.0.0.1","localhost","[::1]"].includes(url.hostname) || !/^\/madevi_ci_screenshots(?:_[a-z0-9_]+)?$/.test(url.pathname) || url.search || url.hash) {
  throw new Error("Setel MADEVI_TEST_DATABASE_URL ke database PostgreSQL loopback kosong bernama madevi_ci_screenshots.");
}
const isolated = new Pool({connectionString:url.toString(),connectionTimeoutMillis:5000});
try {
  const {rows} = await isolated.query("SELECT current_database() AS name, EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public') AS occupied");
  if (rows[0].occupied || rows[0].name !== url.pathname.slice(1)) throw new Error("Gunakan database screenshot baru dan kosong.");
} finally { await isolated.end(); }
const directory = await mkdtemp(join(tmpdir(), "madevi-screenshots-"));
let app, browser;
try {
  const socket = createSocket();
  const appPort = await listen(socket);
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://${loopback}:${appPort}`;
  const password = randomBytes(24).toString("hex");
  // Override every service setting so the original Next application connects only to the test database.
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR)$/i.test(key)));
  Object.assign(env, {
    DATABASE_URL: url.toString(),
    SMTP_HOST:"", SMTP_PORT:"", SMTP_USER:"", SMTP_PASS:"", MAIL_FROM:"",
    GOOGLE_CLIENT_ID:"", GOOGLE_CLIENT_SECRET:"", MADEVI_PROXY_SECRET:"", MEDIA_BACKEND:"postgres",
    MADEVI_BACKUP_DIR:"", MADEVI_BACKUP_KEY:"",
    MADEVI_QA_HIDE_DEV_INDICATOR:"1",
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DEMO_PASSWORD: password,
    OWNER_USERNAME:"Madevi-Admin",
    OWNER_EMAIL:"madevi-admin@example.invalid",
    OWNER_PASSWORD:password,
    NODE_ENV: "development",
    MADEVI_ENV: "dev",
    MADEVI_DEMO_MODE: "true",
    TRUST_PROXY_HEADERS: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  await run(["scripts/migrate.mjs"], root, env);
  await run(["scripts/seed-demo.mjs","--user-only"], root, env);
  await run(["scripts/create-owner.mjs"], root, env);
  app = start(["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", loopback, "--port", String(appPort)], root, env);
  await waitForApp(origin, app);

  browser = await chromium.launch({ executablePath: process.env.MADEVI_CHROMIUM_PATH || undefined });
  const desktopSize = { width: 1440, height: 900 };
  const desktop = await openPage(browser, origin, desktopSize);
  const mobile = await openPage(browser, origin, { width: 390, height: 844 }, true);
  for (const [page, filename] of [[desktop, imageNames[0]], [mobile, imageNames[1]]]) {
    await page.goto(origin);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await capture(page, directory, filename);
  }

  await desktop.getByRole("button", { name: "Buka menu" }).click();
  await desktop.getByText("Ruang Madevi", { exact: true }).last().waitFor();
  await capture(desktop, directory, imageNames[2]);

  await desktop.getByRole("button", { name: "Profil", exact: true }).click();
  await signIn(desktop, "Madevi-User", password);
  await desktop.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  await desktop.getByRole("heading", { name: "Madevi-User", exact: true }).waitFor();
  await desktop.getByText("@madevi-user", { exact: true }).waitFor();
  await capture(desktop, directory, imageNames[3]);
  await desktop.getByRole("button",{name:"Buka pesan",exact:true}).click();
  await desktop.getByRole("tab",{name:"Sistem",exact:true,selected:true}).waitFor();

  const admin = await openPage(browser, origin, desktopSize);
  await admin.goto(`${origin}/admin`);
  await admin.getByRole("heading", { name: "Masuk Admin" }).waitFor();
  await signIn(admin, "Madevi-Admin", password);
  await admin.getByRole("link",{name:"Siapkan autentikator"}).click();
  await admin.getByLabel("Kata sandi",{exact:true}).fill(password);
  const enrollment=admin.waitForResponse(response=>response.url().endsWith("/api/auth/two-factor/enable"));
  await admin.getByRole("button",{name:"Siapkan autentikator"}).click();
  const result=await enrollment;
  assert.equal(result.status(),200,"Aktivasi autentikator admin gagal");
  const secret=new URL((await result.json()).totpURI).searchParams.get("secret");
  await admin.getByLabel("Kode autentikator").fill(authenticatorCode(secret));
  await admin.getByRole("button",{name:"Aktifkan"}).click();
  await admin.getByRole("heading", { name: "Dashboard" }).waitFor();
  await admin.getByText("Terhubung", { exact: true }).waitFor();
  await capture(admin, directory, imageNames[4]);

  const output = join(root, "docs", "screenshots");
  await mkdir(output, { recursive: true });
  for (const name of imageNames) await copyFile(join(directory, name), join(output, name));
  console.log(`Screenshot lokal selesai: ${imageNames.join(", ")}`);
} finally {
  await browser?.close();
  if (app && app.exitCode === null && app.signalCode === null) {
    const closed = once(app, "close");
    app.kill();
    await closed;
  }
  await rm(directory, { recursive: true, force: true });
}
