import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const { searchParams } = new URL(req.url);
    const window_minutes = parseInt(searchParams.get("window_minutes") || "60");
    const cutoff = new Date(Date.now() - window_minutes * 60 * 1000).toISOString();
    const paramDeviceId = searchParams.get("device_id");

    let device_id: string;
    if (paramDeviceId) {
      const check = await sql`
        SELECT device_id FROM devices
        WHERE device_id = ${paramDeviceId} AND tenant_id = ${tenantId}
        LIMIT 1
      ` as any[];
      if (!check.length) return NextResponse.json({ error: "device not found" }, { status: 403 });
      device_id = paramDeviceId;
    } else {
      const devices = await sql`
        SELECT device_id FROM devices
        WHERE tenant_id = ${tenantId} AND status = 'claimed'
        ORDER BY last_seen DESC LIMIT 1
      ` as any[];
      if (!devices.length) return NextResponse.json({ buckets: [] });
      device_id = devices[0].device_id;
    }

    const buckets = await sql`
      SELECT
        date_trunc('minute', ts_utc) AS bucket,
        AVG(http_ms) FILTER (WHERE http_err IS NULL OR http_err = '') AS avg_ms,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE http_err IS NULL OR http_err = '') AS success
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc > ${cutoff}::timestamptz
      GROUP BY bucket
      ORDER BY bucket ASC
    ` as any[];

    return NextResponse.json({ buckets });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
