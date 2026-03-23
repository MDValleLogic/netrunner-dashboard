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
  const hours    = Math.min(parseInt(searchParams.get("hours") ?? "24"), 168);

  const hourly = await sql`
    SELECT
      hour_utc,
      device_id,
      unique_devices,
      avg_rssi,
      new_devices,
      returning_devices
    FROM   bt_scans_hourly
    WHERE  tenant_id = ${tenantId}::uuid
      AND  hour_utc > NOW() - (${hours} || ' hours')::interval
      ${deviceId ? sql`AND device_id = ${deviceId}` : sql``}
    ORDER  BY hour_utc ASC
  `;

  const topManufacturers = await sql`
    SELECT
      COALESCE(manufacturer, 'Unknown') AS manufacturer,
      COUNT(DISTINCT mac)               AS device_count
    FROM   bt_scans
    WHERE  tenant_id = ${tenantId}::uuid
      AND  ts_utc > NOW() - (${hours} || ' hours')::interval
      ${deviceId ? sql`AND device_id = ${deviceId}` : sql``}
    GROUP  BY manufacturer
    ORDER  BY device_count DESC
    LIMIT  10
  `;

  const topDevices = await sql`
    SELECT
      mac,
      name,
      manufacturer,
      COUNT(*)        AS sightings,
      AVG(rssi)       AS avg_rssi,
      MIN(ts_utc)     AS first_seen,
      MAX(ts_utc)     AS last_seen
    FROM   bt_scans
    WHERE  tenant_id = ${tenantId}::uuid
      AND  ts_utc > NOW() - (${hours} || ' hours')::interval
      ${deviceId ? sql`AND device_id = ${deviceId}` : sql``}
    GROUP  BY mac, name, manufacturer
    ORDER  BY sightings DESC
    LIMIT  50
  `;

  return NextResponse.json({ hourly, topManufacturers, topDevices });
}
