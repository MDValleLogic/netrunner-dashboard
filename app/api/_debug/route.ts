export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function GET() {
  try {
    await requireTenantSession();
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
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
