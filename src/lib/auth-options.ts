import { twoFactor, username, emailOTP } from "better-auth/plugins";
import { pool } from "./db.ts";
import { createSmtpTransport } from "./mail.ts";
import type { BetterAuthOptions } from "better-auth";
import { isDemoAllowed } from "./config.ts";
import { authOrigin, googleSettings, smtpSettings, validateEnvironment } from "./env.ts";
import { assertGoogleAccountAllowed, denyPrivilegedOAuth, isPrivileged, privilegedSessionPath, verifiedMfaPath } from "./auth-policy.ts";

validateEnvironment();
const smtpConfig = smtpSettings();
const googleConfig = googleSettings();
const smtp = smtpConfig && createSmtpTransport(smtpConfig);

async function sendMail(to: string, content: string, subject: string) {
  if (!smtp || !smtpConfig) throw new Error("Pengiriman email belum dikonfigurasi");
  try {
    await smtp.sendMail({ from: smtpConfig.from, to, subject, text: `${subject}\n\n${content}` });
  } catch {
    console.error(JSON.stringify({ event: "smtp.send", outcome: "unavailable" }));
    throw new Error("Email belum dapat dikirim");
  }
}

export const authOptions = {
  appName: "MADEVI",
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authOrigin(),
  logger: {
    level: "warn",
    log(level) { console.warn(JSON.stringify({ event: "auth.dependency", level })); },
  },
  // Request quotas are enforced by Madevi using authenticated principals and verified proxy metadata.
  rateLimit: { enabled: false },
  advanced: {
    ipAddress: { disableIpTracking: true },
    cookies: { trust_device: { name: "madevi.mfa_device" } },
  },
  session: {
    additionalFields: { madeviMfa: { type: "boolean", defaultValue: false, input: false, returned: false } },
  },
  socialProviders: googleConfig ? {
    google: { ...googleConfig, mapProfileToUser: assertGoogleAccountAllowed },
  } : {},
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }: { user: { email: string }, url: string }) => sendMail(user.email, url, "Atur ulang kata sandi MADEVI"),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }, url: string }) => sendMail(user.email, url, "Verifikasi email MADEVI"),
  },
  user: { additionalFields: {
    birthDate: { type: "string" as const, required: false, returned: false },
    city: { type: "string" as const, required: false, returned: false },
    phone: { type: "string" as const, required: false, returned: false },
    madeviRole: { type: "string" as const, defaultValue: "user", input: false, returned: false },
    suspended: { type: "boolean" as const, defaultValue: false, input: false, returned: false },
    isDemo: { type: "boolean" as const, defaultValue: false, input: false, returned: false },
  } },
  databaseHooks: {
    account: { create: { before: async account => {
      if (account.providerId === "credential") return;
      const result = await pool.query('SELECT "madeviRole" FROM "user" WHERE id=$1', [account.userId]);
      if (result.rows[0] && isPrivileged(result.rows[0].madeviRole)) denyPrivilegedOAuth();
    } } },
    session: { create: { before: async (session, context) => {
      const result = await pool.query(
        'SELECT suspended, "emailVerified", "isDemo", "madeviRole" FROM "user" WHERE id=$1', [session.userId],
      );
      const user = result.rows[0];
      if (!user || user.suspended || !user.emailVerified || (user.isDemo && !isDemoAllowed())) return false;
      if (isPrivileged(user.madeviRole) && !privilegedSessionPath(context?.path)) denyPrivilegedOAuth();
      // Credential login and legacy sessions start without administrative assurance.
      return { data: { ...session, madeviMfa: verifiedMfaPath(context?.path) } };
    } } },
  },
  plugins: [emailOTP({otpLength:6,expiresIn:600,allowedAttempts:3,storeOTP:"hashed",disableSignUp:true,changeEmail:{enabled:true,verifyCurrentEmail:false},rateLimit:{window:60,max:3},sendVerificationOTP:async({email,otp,type})=>{if(type!=="forget-password"&&type!=="change-email")throw new Error("Jenis OTP tidak didukung");await sendMail(email,`Kode OTP: ${otp}\nBerlaku 10 menit dan hanya sekali pakai.`,type==="change-email"?"Verifikasi email baru MADEVI":"Atur ulang kata sandi MADEVI")}}), username({ immutableUsername: true, usernameValidator: (value: string) => /^[a-zA-Z0-9_.-]{3,30}$/.test(value) }), twoFactor({ issuer: "MADEVI", trustDeviceMaxAge: 0 })],
} satisfies BetterAuthOptions;

