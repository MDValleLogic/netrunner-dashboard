import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
  const target    = searchParams.get("target") || null;
  const limit     = parseInt(searchParams.get("limit") || "10");

  try {
    const traces = target
      ? await sql`
          SELECT * FROM route_traces
          WHERE device_id = ${device_id} AND target = ${target}
          ORDER BY ts_utc DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM route_traces
          WHERE device_id = ${device_id}
          ORDER BY ts_utc DESC LIMIT ${limit}
        `;

    if (!traces.length) {
      return NextResponse.json({ ok: true, traces: [], hops: [], targets: [] });
    }

    const latest_trace_id = traces[0].id;
    const hops = await sql`
      SELECT * FROM route_hops
      WHERE trace_id = ${latest_trace_id}
      ORDER BY hop_num ASC
    `;

    const targets = await sql`
      SELECT DISTINCT target FROM route_traces
      WHERE device_id = ${device_id}
      ORDER BY target
    `;

    return NextResponse.json({
      ok: true,
      device_id,
      latest_trace: traces[0],
      traces,
      hops,
      targets: targets.map((t: any) => t.target),
    });

  } catch (e: any) {
    console.error("[routerunner/results]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
