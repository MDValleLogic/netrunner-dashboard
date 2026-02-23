import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

type IngestBody = {
  ts_utc?: string;
  url?: string;

  // new-ish payload from probe
  dns_ms?: number | string | null;
  http_ms?: number | string | null;
  http_err?: string | null;

  // legacy / alternate fields
  latency_ms?: number | string | null;
  success?: boolean;
  error?: string | null;
};

/**
 * Normalize neon/sql results to array
 */
function toArray<T = AnyRow>(q: unknown): T[] {
  if (!q) return [];
  if (Array.isArray(q)) return q as T[];
  if (typeof q === "object" && q !== null && "rows" in q) {
    const rows = (q as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s !== "" && Number.isFinite(Number(s))) return Number(s);
  }
  return null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  // results.latency_ms and results.dns_ms are integer in DB
  return Math.round(n);
}

export async function POST(req: Request) {
  try {
    // 1) Verify device headers
    const v = await verifyDevice(req);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized_device" }, { status: 401 });
    }
    const deviceId = v.deviceId;

    // 2) Parse JSON body
    let body: IngestBody;
    try {
      body = (await req.json()) as IngestBody;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const url = (body.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: "url_required" }, { status: 400 });
    }

    // 3) Determine timestamp
    const ts = body.ts_utc ? new Date(body.ts_utc) : new Date();
    if (Number.isNaN(ts.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid_ts_utc" }, { status: 400 });
    }

    // 4) Map latency (HTTP) -> integer ms
    const latency_ms =
      asInt(body.latency_ms) ??
      asInt(body.http_ms);

    // 5) DNS latency -> integer ms (optional)
    const dns_ms = asInt(body.dns_ms);

    // 6) Map error
    const error =
      (typeof body.error === "string" ? body.error : null) ??
      (typeof body.http_err === "string" ? body.http_err : null);

    // 7) Determine success
    const success =
      typeof body.success === "boolean"
        ? body.success
        : !error;

    // 8) Load device tenant_id
    const devQ = await sql`
      select device_id, tenant_id, status
      from devices
      where device_id = ${deviceId}
      limit 1
    `;
    const devRows = toArray<{ device_id: string; tenant_id: string | null; status: string }>(devQ);
    const device = devRows[0];

    if (!device) {
      return NextResponse.json({ ok: false, error: "device_not_found" }, { status: 404 });
    }
    if (!device.tenant_id) {
      return NextResponse.json({ ok: false, error: "device_missing_tenant" }, { status: 409 });
    }
    const tenant_id = device.tenant_id;

    // 9) Set tenant context for RLS
    await sql`select set_config('app.tenant_id', ${tenant_id}, true)`;

    // 10) Insert into results (NOW includes dns_ms)
    const ins = await sql`
      insert into results
        (device_id, ts, url, latency_ms, dns_ms, success, error, tenant_id)
      values
        (${deviceId}, ${ts.toISOString()}, ${url}, ${latency_ms}, ${dns_ms}, ${success}, ${error}, ${tenant_id})
      returning id
    `;

    const insRows = toArray<{ id: number | string }>(ins);
    const inserted_id = insRows[0]?.id ?? null;

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      inserted_id,
      tenant_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}
