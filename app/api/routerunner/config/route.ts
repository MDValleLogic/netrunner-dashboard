import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

  const defaults = { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 };

  try {
    const rows = await sql`
      SELECT routerunner_config, updated_at
      FROM devices
      WHERE device_id = ${device_id}
      LIMIT 1
    `;
    const r = (rows as any[])[0];
    if (!r || !r.routerunner_config) {
      return NextResponse.json({ ok: true, device_id, config: defaults, source: "default" });
    }
    const cfg = typeof r.routerunner_config === "string"
      ? JSON.parse(r.routerunner_config)
      : r.routerunner_config;
    return NextResponse.json({
      ok: true, device_id,
      config: {
        targets: cfg.targets || defaults.targets,
        interval_seconds: cfg.interval_seconds || defaults.interval_seconds,
      },
      updated_at: r.updated_at,
      source: "saved",
    });
  } catch (e: any) {
    console.error("[routerunner/config GET]", e.message);
    return NextResponse.json({ ok: true, device_id, config: defaults, source: "default", error: e.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, targets, interval_seconds } = await req.json();
    if (!device_id || !targets) return NextResponse.json({ ok: false, error: "device_id and targets required" }, { status: 400 });

    const config = { targets, interval_seconds: interval_seconds || 300 };

    await sql`
      UPDATE devices
      SET routerunner_config = ${JSON.stringify(config)}::jsonb,
          updated_at = NOW()
      WHERE device_id = ${device_id}
    `;

    return NextResponse.json({ ok: true, device_id, targets, interval_seconds, config });
  } catch (e: any) {
    console.error("[routerunner/config POST]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
