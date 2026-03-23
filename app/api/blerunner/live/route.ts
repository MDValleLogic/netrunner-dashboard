import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const tenantId = (session.user as any).tenantId;

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

  const scans = await sql`
    SELECT DISTINCT ON (mac)
      mac,
      name,
      rssi,
      manufacturer,
      service_uuids,
      tx_power,
      ts_utc,
      device_id
    FROM   bt_scans
    WHERE  tenant_id = ${tenantId}::uuid
      AND  ts_utc > NOW() - INTERVAL '5 minutes'
      ${deviceId ? sql`AND device_id = ${deviceId}` : sql``}
    ORDER  BY mac, rssi DESC NULLS LAST
    LIMIT  ${limit}
  `;

  const stats = await sql`
    SELECT
      COUNT(DISTINCT mac)                                                    AS total_devices,
      COUNT(DISTINCT mac) FILTER (WHERE rssi > -70)                         AS near_devices,
      COUNT(DISTINCT mac) FILTER (WHERE name IS NOT NULL)                   AS named_devices,
      COUNT(DISTINCT manufacturer) FILTER (WHERE manufacturer IS NOT NULL)  AS manufacturers,
      MAX(ts_utc)                                                            AS newest_scan
    FROM bt_scans
    WHERE tenant_id = ${tenantId}::uuid
      AND ts_utc > NOW() - INTERVAL '5 minutes'
      ${deviceId ? sql`AND device_id = ${deviceId}` : sql``}
  `;

  return NextResponse.json({ scans, stats: stats[0] ?? {} });
}
