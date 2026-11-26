import { NextResponse } from "next/server";
import { googleSettings, smtpSettings } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    google: Boolean(googleSettings()),
    email: Boolean(smtpSettings()),
  }, { headers: { "Cache-Control": "no-store" } });
}
