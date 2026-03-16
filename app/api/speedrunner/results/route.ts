import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const { searchParams } = new URL(req.url);
    const device_id = searchParams.get("device_id") || "";
    const limit     = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const region    = searchParams.get("region") || "";

    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const check = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
      LIMIT 1
    ` as any[];
    if (!check.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

    const latestByRegion = await sql`
      SELECT DISTINCT ON (region) id, device_id, ts_utc, engine, region, region_city,
        download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_city,
        server_country, isp, result_url
      FROM speed_results
      WHERE device_id = ${device_id} AND error IS NULL
      ORDER BY region, ts_utc DESC
    ` as any[];

    const history = region
      ? await sql`
          SELECT id, ts_utc, engine, region, region_city, download_mbps, upload_mbps,
            ping_ms, jitter_ms, server_name, server_city, isp, result_url
          FROM speed_results
          WHERE device_id = ${device_id} AND region = ${region} AND error IS NULL
          ORDER BY ts_utc DESC LIMIT ${limit}
        ` as any[]
      : await sql`
          SELECT id, ts_utc, engine, region, region_city, download_mbps, upload_mbps,
            ping_ms, jitter_ms, server_name, server_city, isp, result_url
          FROM speed_results
          WHERE device_id = ${device_id} AND error IS NULL
          ORDER BY ts_utc DESC LIMIT ${limit}
        ` as any[];

    const regions = await sql`
      SELECT DISTINCT region, region_city FROM speed_results
      WHERE device_id = ${device_id} AND region IS NOT NULL
      ORDER BY region
    ` as any[];

    return NextResponse.json({
      ok: true,
      device_id,
      latest_by_region: latestByRegion,
      history,
      regions: regions.map((r: any) => ({ region: r.region, city: r.region_city }))
    });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
