export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_DATABASE_URL_UNPOOLED: !!process.env.DATABASE_URL_UNPOOLED,
    has_POSTGRES_URL: !!process.env.POSTGRES_URL,
    env_keys_hint: Object.keys(process.env).filter(
      (k) =>
        k === "DATABASE_URL" ||
        k === "DATABASE_URL_UNPOOLED" ||
        k === "POSTGRES_URL" ||
        k.startsWith("POSTGRES_")
    ),
  });
}

