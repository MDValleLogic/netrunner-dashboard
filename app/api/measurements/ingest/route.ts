import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IngestBody = {
  ts_utc?: string;        // ISO string
  url?: string;
  dns_ms?: number;        // accepted but not stored in current schema
  http_ms?: number;       // mapped to latency_ms
  http_err?: string | null;

  // allow newer payloads too
  latency_ms?: number;
  success?: boolean;
  error?: string | null;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function POST(req: Request) {
  // 1) Device auth
  const v = await verifyDevice(req);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized_device" }, { status: 401 });
  }
  const deviceId = v.deviceId;

  // 2) Parse body
  let body: IngestBody = {};
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: "url_required" }, { status: 400 });
  }

  // ts: accept ts_utc else use now()
  const ts = body.ts_utc ? new Date(body.ts_utc) : new Date();
  if (Number.isNaN(ts.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid_ts_utc" }, { status: 400 });
  }

  // latency: prefer explicit latency_ms, else map http_ms
  const latency_ms =
    asNumber(body.latency_ms) ??
    asNumber(body.http_ms);

  // error: prefer explicit error, else map http_err
  const error =
    (typeof body.error === "string" ? body.error : null) ??
    (typeof body.http_err === "string" ? body.http_err : null);

  // success: prefer explicit success, else infer
  const success =
    typeof body.success === "boolean"
      ? body.success
      : !error;

  // 3) Load device tenant_id (required for RLS-protected results insert)
  const devQ = await sql`
    select device_id, tenant_id, status
    from devices
    where device_id = ${deviceId}
    limit 1
  `;
  const devRow =
    Array.isArray(devQ) ? devQ[0] :
    (devQ as any)?.rows?.[0] ?? null;

  if (!devRow) {
    return NextResponse.json({ ok: false, error: "device_not_found" }, { status: 404 });
  }

  const tenant_id: string | null = devRow.tenant_id ?? null;
  if (!tenant_id) {
    // For MVP we require device already bound to a tenant
    return NextResponse.json(
      { ok: false, error: "device_missing_tenant" },
      { status: 409 }
    );
  }

  // 4) Set tenant context for RLS
  await sql`select set_config('app.tenant_id', ${tenant_id}, true);`;

  // 5) Insert into results
  const ins = await sql`
    insert into results
      (device_id, ts, url, latency_ms, success, error, tenant_id)
    values
      (${deviceId}, ${ts.toISOString()}, ${url}, ${latency_ms}, ${success}, ${error}, ${tenant_id})
    returning id
  `;

  const id =
    Array.isArray(ins) ? ins[0]?.id :
    (ins as any)?.rows?.[0]?.id;

  return NextResponse.json({
    ok: true,
    device_id: deviceId,
    inserted_id: id ?? null,
    tenant_id,
  });
}
