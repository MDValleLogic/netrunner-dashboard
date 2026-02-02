import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

const OFFLINE_AFTER_SECONDS = 10 * 60; // 10 minutes

function safeJsonParse<T>(s: any, fallback: T): T {
  try {
    if (!s) return fallback;
    if (typeof s === "object") return s as T;
    return JSON.parse(String(s)) as T;
  } catch {
    return fallback;
  }
}

// Your db helper may return either { rows: [...] } OR an array directly.
// Normalize it so route logic is stable.
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

    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
    }

    // Device row
    const devRes = await sql`
      select device_id, config_json, last_seen
      from devices
      where device_id = ${deviceId}
      limit 1
    `;

    const dev = getRows<{ device_id: string; config_json: any; last_seen: string | null }>(devRes)[0];

    const config = safeJsonParse<any>(dev?.config_json, {});
    const webrunner = config?.webrunner ?? config ?? {}; // backward compatible

    const interval_s = Number(webrunner?.interval_s ?? webrunner?.interval ?? 0) || 0;
    const urls: string[] = Array.isArray(webrunner?.urls) ? webrunner.urls : [];

    const enabled: boolean =
      typeof webrunner?.enabled === "boolean"
        ? webrunner.enabled
        : // default if older configs: enabled if configured
          interval_s > 0 && urls.length > 0;

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

    // Latest measurement (keep as-is for MVP)
    const mRes = await sql`
      select ts_utc, url, dns_ms, http_ms, http_err
      from measurements
      where device_id = ${deviceId}
      order by ts_utc desc
      limit 1
    `;

    const m = getRows<{
      ts_utc: string;
      url: string;
      dns_ms: number;
      http_ms: number;
      http_err?: string | null;
    }>(mRes)[0];

    const configured = interval_s > 0 && urls.length > 0;

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      appliance: {
        online,
        last_seen_utc,
        last_seen_age_s,
        offline_after_s: OFFLINE_AFTER_SECONDS,
      },
      webrunner: {
        enabled,
        configured,
        interval_s,
        url_count: urls.length,
      },
      last_measurement: m
        ? {
            ts_utc: m.ts_utc,
            url: m.url,
            dns_ms: Number(m.dns_ms),
            http_ms: Number(m.http_ms),
            http_err: (m.http_err as string) || "",
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

