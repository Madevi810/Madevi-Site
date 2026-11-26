import { isDemoAllowed } from "./config.ts";

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL belum dikonfigurasi");
  let url: URL;
  const invalid = "DATABASE_URL harus berupa URI PostgreSQL dengan host dan nama database";
  try { url = new URL(value); }
  catch { throw new Error(invalid); }
  const overridesHost = [...url.searchParams.keys()].some(key => /^(host|hostaddr|port|dbname|database|user|password)$/i.test(key));
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length <= 1 ||
      url.hash || overridesHost) throw new Error(invalid);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const modes = url.searchParams.getAll("sslmode");
  if ((env.MADEVI_ENV || "dev") !== "dev" && !loopback && (modes.length !== 1 || modes[0] !== "verify-full")) {
    throw new Error("DATABASE_URL non-loopback untuk staging atau produksi memerlukan sslmode=verify-full");
  }
  if (!url.port) url.port = "5432";
  return url.href;
}

export function authOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL belum dikonfigurasi");
  let url: URL;
  try { url = new URL(env.BETTER_AUTH_URL); }
  catch { throw new Error("BETTER_AUTH_URL tidak valid"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error("BETTER_AUTH_URL harus berupa origin tanpa kredensial atau path");
  if ((env.MADEVI_ENV || "dev") !== "dev" && url.protocol !== "https:") throw new Error("Staging dan produksi memerlukan HTTPS");
  return url.origin;
}

export function smtpSettings(env: NodeJS.ProcessEnv = process.env) {
  const { SMTP_HOST: host, SMTP_PORT: rawPort, SMTP_USER: user, SMTP_PASS: pass, MAIL_FROM: from } = env;
  if (![host, rawPort, user, pass, from].some(Boolean)) return null;
  if (!host || !rawPort || !user || !pass || !from || /\s|[/@]/.test(host) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
    throw new Error("Konfigurasi SMTP harus lengkap dan valid");
  }
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) throw new Error("SMTP_PORT tidak valid");
  const secure = port === 465;
  return { host, port, from, auth: { user, pass }, secure, requireTLS: !secure && (env.MADEVI_ENV || "dev") !== "dev" };
}

export function googleSettings(env: NodeJS.ProcessEnv = process.env) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
  if (!clientId && !clientSecret) return null;
  if (!clientId?.trim() || !clientSecret?.trim()) throw new Error("Konfigurasi Google harus lengkap");
  return { clientId, clientSecret };
}

export function configurationIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  const issues: string[] = [];
  const mode = env.MADEVI_ENV || "dev";
  if (!["dev", "staging", "production"].includes(mode)) issues.push("MADEVI_ENV harus dev, staging atau production");
  if (env.NODE_ENV === "production" && (!env.MADEVI_ENV || mode === "dev")) issues.push("NODE_ENV=production memerlukan MADEVI_ENV staging atau production");
  for (const validate of [databaseUrl, authOrigin, smtpSettings, googleSettings]) {
    try { validate(env); }
    catch (error) { issues.push(error instanceof Error ? error.message : "Konfigurasi tidak valid"); }
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.trim().length < 32) issues.push("BETTER_AUTH_SECRET harus minimal 32 karakter");
  for (const flag of ["MADEVI_DEMO_MODE", "TRUST_PROXY_HEADERS"] as const) {
    if (env[flag] && !["true", "false"].includes(env[flag])) issues.push(`${flag} harus true atau false`);
  }
  if (env.MADEVI_DEMO_MODE === "true" && !isDemoAllowed(env)) issues.push("Demo memerlukan origin dan database lokal, tanpa proxy tepercaya dan tanpa mode production");
  if (env.TRUST_PROXY_HEADERS === "true") {
    if ((env.MADEVI_PROXY_SECRET?.trim().length ?? 0) < 32) issues.push("Proxy tepercaya memerlukan MADEVI_PROXY_SECRET minimal 32 karakter");
    if (env.MADEVI_PROXY_SECRET && env.MADEVI_PROXY_SECRET === env.BETTER_AUTH_SECRET) issues.push("MADEVI_PROXY_SECRET harus berbeda dari BETTER_AUTH_SECRET");
  }
  if (env.MEDIA_BACKEND && env.MEDIA_BACKEND !== "postgres") issues.push("MEDIA_BACKEND belum didukung");
  return issues;
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const issues = configurationIssues(env);
  if (issues.length) throw new Error(issues.join(". "));
}
