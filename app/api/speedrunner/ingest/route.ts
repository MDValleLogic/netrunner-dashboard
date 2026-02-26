import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, ts_utc, engine, region, region_city, server_id, download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_host, server_city, server_country, isp, result_url, error } = body;
    if (!device_id || !ts_utc || !engine) return NextResponse.json({ ok: false, error: "device_id, ts_utc, engine required" }, { status: 400 });
    await sql`INSERT INTO speed_results (device_id, ts_utc, engine, region, region_city, server_id, download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_host, server_city, server_country, isp, result_url, error) VALUES (${device_id}, ${ts_utc}, ${engine}, ${region||null}, ${region_city||null}, ${server_id||null}, ${download_mbps||null}, ${upload_mbps||null}, ${ping_ms||null}, ${jitter_ms||null}, ${server_name||null}, ${server_host||null}, ${server_city||null}, ${server_country||null}, ${isp||null}, ${result_url||null}, ${error||null})`;
    return NextResponse.json({ ok: true, device_id, region, engine });
  } catch (e: any) {
    console.error("[speedrunner/ingest]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
