import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, ts_utc, target, dest_ip, hop_count, total_hops, hops } = body;

    if (!device_id || !ts_utc || !target || !hops) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    const trace = await sql`
      INSERT INTO route_traces (device_id, ts_utc, target, dest_ip, hop_count, total_hops)
      VALUES (${device_id}, ${ts_utc}, ${target}, ${dest_ip}, ${hop_count}, ${total_hops})
      RETURNING id
    `;

    const trace_id = trace[0].id;

    for (const hop of hops) {
      await sql`
        INSERT INTO route_hops (
          trace_id, device_id, ts_utc, target,
          hop_num, ip, hostname, rtt_ms, timeout,
          org, isp, asn, country, city
        ) VALUES (
          ${trace_id}, ${device_id}, ${ts_utc}, ${target},
          ${hop.hop}, ${hop.ip || null}, ${hop.hostname || null},
          ${hop.rtt_ms || null}, ${hop.timeout || false},
          ${hop.org || ""}, ${hop.isp || ""}, ${hop.asn || ""},
          ${hop.country || ""}, ${hop.city || ""}
        )
      `;
    }

    return NextResponse.json({ ok: true, trace_id, hops_inserted: hops.length });

  } catch (e: any) {
    console.error("[routerunner/ingest]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
