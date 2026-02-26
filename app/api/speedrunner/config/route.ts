import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  const defaults = { interval_seconds: 3600, regions: ["Northeast US","Southeast US","Midwest US","West Coast US","Europe","Asia Pacific"] };
  try {
    const rows = await sql`SELECT speedrunner_config, updated_at FROM devices WHERE device_id = ${device_id} LIMIT 1` as any[];
    const r = rows[0];
    if (!r || !r.speedrunner_config) return NextResponse.json({ ok: true, device_id, config: defaults, source: "default" });
    const cfg = typeof r.speedrunner_config === "string" ? JSON.parse(r.speedrunner_config) : r.speedrunner_config;
    return NextResponse.json({ ok: true, device_id, config: { interval_seconds: cfg.interval_seconds||defaults.interval_seconds, regions: cfg.regions||defaults.regions }, updated_at: r.updated_at, source: "saved" });
  } catch (e: any) {
    return NextResponse.json({ ok: true, device_id, config: defaults, source: "default" });
  }
}
export async function POST(req: NextRequest) {
  try {
    const { device_id, interval_seconds, regions } = await req.json();
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
    const config = JSON.stringify({ interval_seconds: interval_seconds||3600, regions: regions||[] });
    await sql`UPDATE devices SET speedrunner_config = ${config}::jsonb, updated_at = NOW() WHERE device_id = ${device_id}`;
    return NextResponse.json({ ok: true, device_id, interval_seconds, regions });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
