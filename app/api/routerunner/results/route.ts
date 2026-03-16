import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const { searchParams } = new URL(req.url);
    const target = searchParams.get("target");
    const limit  = parseInt(searchParams.get("limit") || "20");
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
      if (!devices.length) return NextResponse.json({ traces: [] });
      device_id = devices[0].device_id;
    }

    const traces = await sql`
      SELECT t.id, t.ts_utc, t.target, t.dest_ip, t.hop_count, t.total_hops,
        json_agg(h ORDER BY h.hop_num) AS hops
      FROM route_traces t
      LEFT JOIN route_hops h ON h.trace_id = t.id
      WHERE t.device_id = ${device_id}
        ${target ? sql`AND t.target = ${target}` : sql``}
      GROUP BY t.id
      ORDER BY t.ts_utc DESC
      LIMIT ${limit}
    ` as any[];

    return NextResponse.json({ traces });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
