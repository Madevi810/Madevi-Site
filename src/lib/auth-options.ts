import { twoFactor, username, emailOTP } from "better-auth/plugins";
import { pool } from "./db.ts";
import nodemailer from "nodemailer";
import { isDemoAllowed } from "./config.ts";
import { validateEnvironment } from "./env.ts";

validateEnvironment();
const mailReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
async function sendMail(to: string, url: string, subject: string) {
  if (!mailReady()) throw new Error("Pengiriman email belum dikonfigurasi");
  const smtp = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await smtp.sendMail({ from: process.env.MAIL_FROM, to, subject, text: `${subject}\n\n${url}` });
}

export const authOptions = {
  appName: "MADEVI",
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
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
  databaseHooks: { session: { create: { before: async (session: { userId: string }) => {
    const result = await pool.query('SELECT suspended, "emailVerified", "isDemo" FROM "user" WHERE id = $1', [session.userId]);
    if (!result.rows[0] || result.rows[0].suspended || !result.rows[0].emailVerified || (result.rows[0].isDemo && !isDemoAllowed())) return false as const;
    return { data: session };
  } } } },
  plugins: [emailOTP({otpLength:6,expiresIn:600,allowedAttempts:3,storeOTP:"hashed",disableSignUp:true,changeEmail:{enabled:true,verifyCurrentEmail:false},rateLimit:{window:60,max:3},sendVerificationOTP:async({email,otp,type})=>{if(type!=="forget-password"&&type!=="change-email")throw new Error("Jenis OTP tidak didukung");await sendMail(email,`Kode OTP: ${otp}\nBerlaku 10 menit dan hanya sekali pakai.`,type==="change-email"?"Verifikasi email baru MADEVI":"Atur ulang kata sandi MADEVI")}}), username({ immutableUsername: true, usernameValidator: (value: string) => /^[a-zA-Z0-9_.-]{3,30}$/.test(value) }), twoFactor({ issuer: "MADEVI" })],
};

