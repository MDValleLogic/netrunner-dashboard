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
  const session = await getServerSession(authOptions);
  const auth = session
    ? { ok: true, deviceId: new URL(req.url).searchParams.get("device_id") || "" }
    : await verifyDevice(req);
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const deviceId = auth.deviceId;

  try {
    const rows = (await sql`
      SELECT interval_seconds, urls FROM device_config
      WHERE device_id = ${deviceId} LIMIT 1
    `) as any[];

    if (!rows.length) return NextResponse.json({ ok: true, config: SAFE_DEFAULT });

    const r = rows[0];
    return NextResponse.json({
      ok: true,
      config: {
        urls: Array.isArray(r.urls) ? r.urls : SAFE_DEFAULT.urls,
        interval_seconds: r.interval_seconds || SAFE_DEFAULT.interval_seconds,
        timeout_seconds: SAFE_DEFAULT.timeout_seconds,
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

  await sql`
    INSERT INTO device_config (device_id, urls, interval_seconds, updated_at)
    VALUES (${device_id}, ${cleanUrls}, ${interval}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      urls = EXCLUDED.urls,
      interval_seconds = EXCLUDED.interval_seconds,
      updated_at = NOW()
  `;

  return NextResponse.json({ ok: true, config: { urls: cleanUrls, interval_seconds: interval } });
}
