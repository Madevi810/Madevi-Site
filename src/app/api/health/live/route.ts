import { apiRoute } from "@/lib/api-response";
import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
function handleGET(){return NextResponse.json({status:"ok"},{headers:{"Cache-Control":"no-store"}})}

export const GET=apiRoute("/api/health/live", "GET", handleGET, true);
