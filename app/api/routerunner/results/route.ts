import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const target = searchParams.get("target");
    const limit  = parseInt(searchParams.get("limit") || "20");

    const devices = await sql`
      SELECT device_id FROM devices 
      WHERE tenant_id = ${token.tenantId as string} AND claimed = true
      ORDER BY last_seen DESC LIMIT 1
    ` as any[];

    if (!devices.length) return NextResponse.json({ traces: [] });
    const device_id = devices[0].device_id;

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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
