import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { copyFile, cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer as createSocket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { chromium } from "playwright";
import { createServer as serveDatabase } from "pglite-server";

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

async function preparePreview(directory) {
  for (const path of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) {
    await cp(join(root, path), join(directory, path), { recursive: true });
  }
  await mkdir(join(directory, "scripts"));
  for (const path of ["migrate.mjs", "seed-demo.mjs", "migrations"]) {
    await cp(join(root, "scripts", path), join(directory, "scripts", path), { recursive: true });
  }
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), "junction");
  await copyFile(join(root, "next.config.ts"), join(directory, "next.config.source.ts"));
  await writeFile(join(directory, "next.config.ts"), [
    'import config from "./next.config.source";',
    "export default { ...config, devIndicators: false };",
    "",
  ].join("\n"));
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

const directory = await mkdtemp(join(tmpdir(), "madevi-screenshots-"));
const db = new PGlite();
const database = serveDatabase(db, { logLevel: 0 });
let app, browser;
try {
  await preparePreview(directory);
  await db.waitReady;
  const dbPort = await listen(database);
  const socket = createSocket();
  const appPort = await listen(socket);
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://${loopback}:${appPort}`;
  const password = randomBytes(24).toString("hex");
  // The preview has no dotenv files and ignores service settings in the caller's shell.
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR)$/i.test(key)));
  Object.assign(env, {
    DATABASE_URL: `postgresql://postgres@127.0.0.1:${dbPort}/postgres`,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DEMO_PASSWORD: password,
    NODE_ENV: "development",
    MADEVI_ENV: "dev",
    MADEVI_DEMO_MODE: "true",
    TRUST_PROXY_HEADERS: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  await run(["scripts/migrate.mjs"], directory, env);
  await run(["scripts/seed-demo.mjs"], directory, env);
  app = start(["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", loopback, "--port", String(appPort)], directory, env);
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

  const admin = await openPage(browser, origin, desktopSize);
  await admin.goto(`${origin}/admin`);
  await admin.getByRole("heading", { name: "Masuk Admin" }).waitFor();
  await signIn(admin, "Madevi-Admin", password);
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
  if (database.listening) await new Promise(resolve => database.close(resolve));
  await db.close();
  await rm(directory, { recursive: true, force: true });
}
