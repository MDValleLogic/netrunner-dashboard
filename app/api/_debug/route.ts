export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: "e5c4567-debug",
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_POSTGRES_URL: !!process.env.POSTGRES_URL,
    env_keys_hint: Object.keys(process.env).filter(k =>
      k === "DATABASE_URL" || k.startsWith("POSTGRES_") || k.startsWith("STORAGE_")
    ),
  });
}
