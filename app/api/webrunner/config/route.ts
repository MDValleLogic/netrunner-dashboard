import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_DEFAULT = {
  urls: ["https://www.google.com/generate_204"],
  interval_seconds: 300,
  timeout_seconds: 10,
};

export async function GET(req: Request) {
  // Allow both browser session (dashboard) and device key auth (Pi)
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id") || "";

  if (!session) {
    // Must be a Pi — verify device key
    const auth = await verifyDevice(req);
    if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!deviceId) return NextResponse.json({ ok: true, config: SAFE_DEFAULT });

  try {
    const rows = (await sql`
      SELECT config_json FROM device_config
      WHERE device_id = ${deviceId} AND config_key = 'webrunner'
      LIMIT 1
    `) as any[];

    if (!rows.length) return NextResponse.json({ ok: true, config: SAFE_DEFAULT });

    const cfg = rows[0].config_json;
    return NextResponse.json({
      ok: true,
      config: {
        urls: Array.isArray(cfg.urls) ? cfg.urls : SAFE_DEFAULT.urls,
        interval_seconds: cfg.interval_seconds || SAFE_DEFAULT.interval_seconds,
        timeout_seconds: cfg.timeout_seconds || SAFE_DEFAULT.timeout_seconds,
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: true, config: SAFE_DEFAULT });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { device_id, urls, interval_seconds } = body || {};
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

  const cleanUrls = Array.isArray(urls)
    ? urls.filter((u: any) => typeof u === "string" && u.startsWith("http"))
    : [];
  const interval = Number.isFinite(Number(interval_seconds)) ? Number(interval_seconds) : 300;
  const config = { urls: cleanUrls, interval_seconds: interval, timeout_seconds: 10 };

  await sql`
    INSERT INTO device_config (device_id, config_key, config_json, updated_at)
    VALUES (${device_id}, 'webrunner', ${JSON.stringify(config)}::jsonb, NOW())
    ON CONFLICT (device_id, config_key) DO UPDATE SET
      config_json = EXCLUDED.config_json,
      updated_at  = NOW()
  `;

  return NextResponse.json({ ok: true, config });
}
