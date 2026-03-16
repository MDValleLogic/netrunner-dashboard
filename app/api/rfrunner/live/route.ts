import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const paramDeviceId = new URL(req.url).searchParams.get("device_id");
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
      if (!devices.length) return NextResponse.json({ networks: [] });
      device_id = devices[0].device_id;
    }

    const latest = await sql`
      SELECT ts_utc FROM rf_scans
      WHERE device_id = ${device_id}
      ORDER BY ts_utc DESC LIMIT 1
    ` as any[];
    if (!latest.length) return NextResponse.json({ networks: [] });

    const ts = latest[0].ts_utc;

    const networks = await sql`
      SELECT bssid, ssid, signal_dbm, channel, frequency_mhz, band, security, bssid_vendor, ts_utc
      FROM rf_scans
      WHERE device_id = ${device_id} AND ts_utc = ${ts}
      ORDER BY signal_dbm DESC
    ` as any[];

    return NextResponse.json({ networks, ts_utc: ts });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
