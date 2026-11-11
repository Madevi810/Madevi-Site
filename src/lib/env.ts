import { isDemoAllowed } from "./config.ts";

export function validateEnvironment(env:NodeJS.ProcessEnv=process.env):void {
  const mode=env.MADEVI_ENV||"dev";if(!["dev","staging","production"].includes(mode))throw new Error("MADEVI_ENV harus dev, staging atau production");
  if(env.NODE_ENV==="production" && (!env.MADEVI_ENV || mode==="dev"))throw new Error("NODE_ENV=production memerlukan MADEVI_ENV staging atau production");
  if(!env.DATABASE_URL)throw new Error("DATABASE_URL belum dikonfigurasi");let db:URL;try{db=new URL(env.DATABASE_URL)}catch{throw new Error("DATABASE_URL tidak valid")};if(!["postgres:","postgresql:"].includes(db.protocol)||!db.hostname)throw new Error("DATABASE_URL harus PostgreSQL");
  if(!env.BETTER_AUTH_SECRET||env.BETTER_AUTH_SECRET.length<32)throw new Error("BETTER_AUTH_SECRET harus minimal 32 karakter");
  if(!env.BETTER_AUTH_URL)throw new Error("BETTER_AUTH_URL belum dikonfigurasi");let url:URL;try{url=new URL(env.BETTER_AUTH_URL)}catch{throw new Error("BETTER_AUTH_URL tidak valid")};
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw new Error("BETTER_AUTH_URL harus berupa origin tanpa kredensial atau path");
  if(mode!=="dev"&&url.protocol!=="https:")throw new Error("Staging dan produksi memerlukan HTTPS");
  if(mode!=="dev"&&env.MADEVI_DEMO_MODE==="true")throw new Error("Demo hanya boleh aktif di development");
  if(env.NODE_ENV==="production"&&env.MADEVI_DEMO_MODE==="true")throw new Error("Demo tidak boleh aktif saat NODE_ENV=production");
  if(env.MADEVI_DEMO_MODE==="true"&&!isDemoAllowed(env))throw new Error("Demo memerlukan origin dan database lokal, tanpa proxy tepercaya dan tanpa mode production");
  if(env.GOOGLE_CLIENT_ID&&!env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)throw new Error("Konfigurasi Google harus lengkap");
  const mail=[env.SMTP_HOST,env.SMTP_PORT,env.SMTP_USER,env.SMTP_PASS,env.MAIL_FROM];if(mail.some(Boolean)&&!mail.every(Boolean))throw new Error("Konfigurasi SMTP harus lengkap");if(env.SMTP_PORT&&(!/^\d+$/.test(env.SMTP_PORT)||Number(env.SMTP_PORT)<1||Number(env.SMTP_PORT)>65535))throw new Error("SMTP_PORT tidak valid");
  if(env.MEDIA_BACKEND&&env.MEDIA_BACKEND!=="postgres")throw new Error("MEDIA_BACKEND belum didukung");if(env.TRUST_PROXY_HEADERS&&!['true','false'].includes(env.TRUST_PROXY_HEADERS))throw new Error("TRUST_PROXY_HEADERS harus true atau false");
}
