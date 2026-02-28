import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const window_minutes = parseInt(searchParams.get("window") || "60");
    const bucket_seconds = parseInt(searchParams.get("bucket") || "60");

    const devices = await sql`
      SELECT device_id FROM devices 
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];

    if (!devices.length) return NextResponse.json({ buckets: [] });
    const device_id = devices[0].device_id;

    const buckets = await sql`
      SELECT
        date_trunc('minute', ts_utc) AS bucket,
        AVG(http_ms) FILTER (WHERE http_err IS NULL OR http_err = '') AS avg_ms,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE http_err IS NULL OR http_err = '') AS success
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc > NOW() - INTERVAL '1 minute' * ${window_minutes}
      GROUP BY bucket
      ORDER BY bucket ASC
    ` as any[];

    return NextResponse.json({ buckets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
