export function isDemoAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.MADEVI_ENV !== "dev" || env.MADEVI_DEMO_MODE !== "true" ||
      (env.NODE_ENV && env.NODE_ENV !== "development") || env.TRUST_PROXY_HEADERS === "true") return false;
  try {
    const origin = new URL(env.BETTER_AUTH_URL || "");
    const db = new URL(env.DATABASE_URL || "");
    const local = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
    return ["http:", "https:"].includes(origin.protocol) && local(origin.hostname) &&
      !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash &&
      ["postgres:", "postgresql:"].includes(db.protocol) && local(db.hostname) &&
      ![...db.searchParams.keys()].some(key => ["host", "hostaddr"].includes(key.toLowerCase()));
  } catch { return false; }
}

export function emailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);
}

