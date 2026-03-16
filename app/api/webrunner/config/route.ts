import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getToken } from "next-auth/jwt";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_DEFAULT = {
  urls: ["https://www.google.com/generate_204"],
  interval_seconds: 300,
  timeout_seconds: 10,
};

async function isAuthorized(req: Request): Promise<boolean> {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (token) return true;
  } catch {}

  const deviceKey = req.headers.get("x-device-key") || "";
  const deviceId  = req.headers.get("x-device-id") || "";
  if (deviceKey && deviceId) {
    const hash = crypto.createHash("sha256").update(deviceKey).digest("hex");
    const rows = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${deviceId}
        AND device_key_hash = ${hash}
        AND status = 'claimed'
      LIMIT 1
    ` as any[];
    if (rows.length) return true;
  }

  return false;
}

// GET — Pi + browser facing, dual auth
export async function GET(req: Request) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id") || "";
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
  } catch {
    return NextResponse.json({ ok: true, config: SAFE_DEFAULT });
  }
}

// POST — user facing, tenant scoped
export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantSession();

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
    }

    const { device_id, urls, interval_seconds } = body || {};
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const check = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
      LIMIT 1
    ` as any[];
    if (!check.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

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
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
