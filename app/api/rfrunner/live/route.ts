import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const devices = await sql`
      SELECT device_id FROM devices
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];
    if (!devices.length) return NextResponse.json({ networks: [] });
    const device_id = devices[0].device_id;

    // Get the most recent scan timestamp
    const latest = await sql`
      SELECT ts_utc FROM rf_scans
      WHERE device_id = ${device_id}
      ORDER BY ts_utc DESC LIMIT 1
    ` as any[];
    if (!latest.length) return NextResponse.json({ networks: [] });

    const ts = latest[0].ts_utc;

    // Get all networks from that scan
    const networks = await sql`
      SELECT bssid, ssid, signal_dbm, channel, frequency_mhz, band, security, ts_utc
      FROM rf_scans
      WHERE device_id = ${device_id} AND ts_utc = ${ts}
      ORDER BY signal_dbm DESC
    ` as any[];

    return NextResponse.json({ networks, ts_utc: ts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
