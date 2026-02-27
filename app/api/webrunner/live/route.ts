import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const window_minutes = parseInt(searchParams.get("window") || "60");

    // Get device for this tenant
    const devices = await sql`
      SELECT device_id FROM devices 
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];

    if (!devices.length) return NextResponse.json({ device: null, measurements: [] });
    const device_id = devices[0].device_id;

    const device = await sql`
      SELECT device_id, nr_serial, vlos_version, ip, hostname, mode, last_seen
      FROM devices WHERE device_id = ${device_id}
    ` as any[];

    const measurements = await sql`
      SELECT ts_utc, url, dns_ms, http_ms, http_err
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc > NOW() - INTERVAL '1 minute' * ${window_minutes}
      ORDER BY ts_utc DESC
      LIMIT 500
    ` as any[];

    return NextResponse.json({ device: device[0], measurements });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
