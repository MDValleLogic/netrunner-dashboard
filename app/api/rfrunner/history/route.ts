import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const bssid = searchParams.get("bssid");
    const window_minutes = parseInt(searchParams.get("window_minutes") || "360");
    const cutoff = new Date(Date.now() - window_minutes * 60 * 1000).toISOString();

    const devices = await sql`
      SELECT device_id FROM devices
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];
    if (!devices.length) return NextResponse.json({ points: [] });
    const device_id = devices[0].device_id;

    const points = bssid
      ? await sql`
          SELECT ts_utc, bssid, ssid, signal_dbm, channel
          FROM rf_scans
          WHERE device_id = ${device_id} AND bssid = ${bssid} AND ts_utc > ${cutoff}::timestamptz
          ORDER BY ts_utc ASC
        ` as any[]
      : await sql`
          SELECT ts_utc, bssid, ssid, signal_dbm, channel
          FROM rf_scans
          WHERE device_id = ${device_id} AND ts_utc > ${cutoff}::timestamptz
          ORDER BY ts_utc ASC
        ` as any[];

    return NextResponse.json({ points });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
