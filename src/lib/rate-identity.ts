import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const rateCookie = "madevi_rate";
export const rateCookieAge = 7 * 24 * 60 * 60;

export function rateHash(value: string, secret = process.env.BETTER_AUTH_SECRET || "") {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function equal(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function trustedClientIp(headers: Headers, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.TRUST_PROXY_HEADERS !== "true" || !env.MADEVI_PROXY_SECRET ||
      !equal(headers.get("x-madevi-proxy-token") || "", env.MADEVI_PROXY_SECRET)) return null;
  const ip = headers.get("x-real-ip")?.trim();
  if (!ip || ip.includes("%")) return null;
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return null;
  const parsed = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  if (!/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(parsed)) return parsed;
  const bytes = parsed.split(":").slice(-2).flatMap(part => {
    const value = Number.parseInt(part, 16);
    return [value >> 8, value & 255];
  });
  return bytes.join(".");
}

export function issueRateCookie(now = Date.now()) {
  const payload = `${randomBytes(16).toString("hex")}.${now}`;
  return `${payload}.${rateHash(`browser:${payload}`)}`;
}

export function browserRateId(cookie?: string, now = Date.now()): string | null {
  if (!cookie || !/^[a-f0-9]{32}\.\d{13}\.[a-f0-9]{64}$/.test(cookie)) return null;
  const [id, time, signature] = cookie.split(".");
  if (Number(time) > now || now - Number(time) >= rateCookieAge * 1000) return null;
  return equal(signature, rateHash(`browser:${id}.${time}`)) ? id : null;
}

export function requestRateIdentity(headers: Headers, cookie?: string) {
  const ip = trustedClientIp(headers);
  if (ip) return { kind: "ip", key: `ip:${rateHash(ip)}` } as const;
  const browser = browserRateId(cookie);
  if (browser) return { kind: "browser", key: `browser:${browser}` } as const;
  return { kind: "anonymous", key: "anonymous" } as const;
}
