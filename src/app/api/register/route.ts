import { apiRoute } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth-config";
import { smtpSettings } from "@/lib/env";
import { bodyJson, sameOrigin } from "@/lib/api";
export const runtime = "nodejs";
const schema = z.object({ username:z.string().regex(/^[a-zA-Z0-9_.-]{3,30}$/), name:z.string().trim().min(2).max(100), birthDate:z.iso.date().refine(d => d <= new Date().toISOString().slice(0,10)), city:z.string().trim().min(1).max(100), email:z.email().max(254), phone:z.string().trim().max(30).optional(), password:z.string().min(10).max(128) });
async function handlePOST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error:"Permintaan tidak valid." }, {status:403});
  if (!smtpSettings()) return NextResponse.json({ error:"Pendaftaran belum tersedia karena email verifikasi belum dikonfigurasi." }, {status:503});
  const data=schema.safeParse(await bodyJson(request).catch(()=>null));
  if (!data.success) return NextResponse.json({error:"Periksa kembali data pendaftaran."},{status:400});
  try { await auth.api.signUpEmail({body: { ...data.data, city: data.data.city || "", phone: data.data.phone || "", callbackURL: "/" }, headers: request.headers }); }
  catch(error) {
    const status=error instanceof Error&&"statusCode" in error?Number(error.statusCode):503;
    return [400,409,422].includes(status)
      ? NextResponse.json({error:"Pendaftaran belum berhasil. Periksa data yang dimasukkan."},{status})
      : NextResponse.json({error:"Hasil pendaftaran belum dapat dikonfirmasi. Periksa email atau coba lagi nanti."},{status:503});
  }
  return NextResponse.json({ok:true});
}

export const POST=apiRoute("/api/register", "POST", handlePOST);
