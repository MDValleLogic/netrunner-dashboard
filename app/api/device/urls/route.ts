import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession();

    const { searchParams } = new URL(req.url);
    const device_id = searchParams.get("device_id") || "";
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });

    const check = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
      LIMIT 1
    ` as any[];
    if (!check.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

    const rows = await sql`
      SELECT DISTINCT url
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc >= NOW() - INTERVAL '24 hours'
      ORDER BY url ASC
    `;

    const urls = (rows as any[]).map((r) => r.url).filter(Boolean);
    return NextResponse.json({ ok: true, device_id, urls });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: "DB query failed", details: String(e?.message ?? e) }, { status: 500 });
  }
}
