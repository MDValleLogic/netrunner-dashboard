import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  try {
    const rows = await sql`SELECT routerunner_config, updated_at FROM devices WHERE device_id = ${device_id} LIMIT 1` as any[];
    const defaults = { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 };
    if (!rows.length || !rows[0].routerunner_config) {
      return NextResponse.json({ ok: true, device_id, config: defaults, source: "default" });
    }
    const cfg = rows[0].routerunner_config;
    return NextResponse.json({ ok: true, device_id, config: { targets: cfg.targets || defaults.targets, interval_seconds: cfg.interval_seconds || defaults.interval_seconds }, updated_at: rows[0].updated_at, source: "saved" });
  } catch (e: any) {
    return NextResponse.json({ ok: true, device_id, config: { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 }, source: "default" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, targets, interval_seconds } = await req.json();
    if (!device_id || !targets) return NextResponse.json({ ok: false, error: "device_id and targets required" }, { status: 400 });
    const config = JSON.stringify({ targets, interval_seconds: interval_seconds || 300 });
    await sql`UPDATE devices SET routerunner_config = ${config}::jsonb, updated_at = NOW() WHERE device_id = ${device_id}`;
    return NextResponse.json({ ok: true, device_id, targets, interval_seconds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
