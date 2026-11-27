import { apiRoute } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { googleSettings, smtpSettings } from "@/lib/env";

function handleGET() {
  return NextResponse.json({
    google: Boolean(googleSettings()),
    email: Boolean(smtpSettings()),
  }, { headers: { "Cache-Control": "no-store" } });
}

export const GET=apiRoute("/api/features", "GET", handleGET);
