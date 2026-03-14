import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const runtime = "nodejs";

const OFFLINE_AFTER_SECONDS = 10 * 60;

function getRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("device_id") || "";
    if (!deviceId) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const devRes = await sql`
      SELECT device_id, last_seen FROM devices WHERE device_id = ${deviceId} LIMIT 1
    `;
    const dev = getRows<{ device_id: string; last_seen: string | null }>(devRes)[0];

    const last_seen_utc = dev?.last_seen || null;
    let online = false;
    let last_seen_age_s: number | null = null;
    if (last_seen_utc) {
      const t = Date.parse(last_seen_utc);
      if (!Number.isNaN(t)) {
        last_seen_age_s = Math.floor((Date.now() - t) / 1000);
        online = last_seen_age_s <= OFFLINE_AFTER_SECONDS;
      }
    }

    const cfgRes = await sql`
      SELECT interval_seconds, urls FROM device_config WHERE device_id = ${deviceId} LIMIT 1
    `;
    const cfg = getRows<{ interval_seconds: number; urls: string[] }>(cfgRes)[0];
    const urls: string[] = cfg?.urls || [];
    const interval_s = cfg?.interval_seconds || 0;

    const mRes = await sql`
      SELECT ts_utc, url, dns_ms, http_ms, http_err FROM measurements
      WHERE device_id = ${deviceId} ORDER BY ts_utc DESC LIMIT 1
    `;
    const m = getRows<any>(mRes)[0];

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      appliance: { online, last_seen_utc, last_seen_age_s, offline_after_s: OFFLINE_AFTER_SECONDS },
      webrunner: { enabled: interval_s > 0 && urls.length > 0, configured: interval_s > 0 && urls.length > 0, interval_s, url_count: urls.length },
      last_measurement: m ? { ts_utc: m.ts_utc, url: m.url, dns_ms: Number(m.dns_ms), http_ms: Number(m.http_ms), http_err: m.http_err || "" } : null,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
