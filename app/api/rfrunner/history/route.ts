import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const range = req.nextUrl.searchParams.get("range") ?? "24h";
    const interval = range === "30d" ? "30 days" : range === "7d" ? "7 days" : "24 hours";

    const devices = await sql`
      SELECT device_id FROM devices
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];
    if (!devices.length) return NextResponse.json({ rows: [] });
    const device_id = devices[0].device_id;

    const rows = await sql`
      SELECT hour_utc, ap_count, ssid_count, best_signal, avg_signal,
             band_24_count, band_5_count, open_count, scan_count
      FROM rf_scans_hourly
      WHERE device_id = ${device_id}
        AND hour_utc >= now() - ${interval}::interval
      ORDER BY hour_utc DESC
    ` as any[];

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
