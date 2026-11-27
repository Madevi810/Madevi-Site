import { apiRoute } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { checkDatabaseReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

async function handleGET() {
  const result = await checkDatabaseReadiness(pool);
  const ready = result === "ready";
  return NextResponse.json(ready ? { status: "ok", database: "ok" } : { status: "not_ready", reason: result }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}

export const GET=apiRoute("/api/health/ready", "GET", handleGET, true);
