import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const DEFAULTS = { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

  try {
    const rows = await sql`
      SELECT config_json FROM device_config
      WHERE device_id = ${device_id} AND config_key = 'routerunner'
      LIMIT 1
    ` as any[];

    if (!rows.length) return NextResponse.json({ ok: true, device_id, config: DEFAULTS });
    return NextResponse.json({ ok: true, device_id, config: rows[0].config_json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { device_id, targets, interval_seconds } = await req.json();
    if (!device_id || !targets) return NextResponse.json({ ok: false, error: "device_id and targets required" }, { status: 400 });

    const config = { targets, interval_seconds: interval_seconds || 300 };

    await sql`
      INSERT INTO device_config (device_id, config_key, config_json, updated_at)
      VALUES (${device_id}, 'routerunner', ${JSON.stringify(config)}::jsonb, NOW())
      ON CONFLICT (device_id, config_key) DO UPDATE SET
        config_json = EXCLUDED.config_json,
        updated_at  = NOW()
    `;

    return NextResponse.json({ ok: true, device_id, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
