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
      if (!devices.length) return NextResponse.json({ device: null, measurements: [] });
      device_id = devices[0].device_id;
    }

    const device = await sql`
      SELECT device_id, nr_serial, agent_version, last_ip, nickname, status, last_seen
      FROM devices WHERE device_id = ${device_id}
    ` as any[];

    const measurements = await sql`
      SELECT ts_utc, url, dns_ms, http_ms, http_err
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc > ${cutoff}::timestamptz
      ORDER BY ts_utc DESC
      LIMIT 500
    ` as any[];

    return NextResponse.json({ device: device[0], measurements });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
