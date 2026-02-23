import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function toArray<T = AnyRow>(q: unknown): T[] {
  if (!q) return [];
  if (Array.isArray(q)) return q as T[];
  if (typeof q === "object" && q !== null && "rows" in q) {
    const rows = (q as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

function asInt(v: string | null, fallback: number) {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized_device" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || auth.deviceId;

  const window_minutes = Math.min(asInt(searchParams.get("window_minutes"), 60), 1440);
  const bucket_seconds = Math.min(Math.max(asInt(searchParams.get("bucket_seconds"), 60), 10), 3600);

  const urlsQ = await sql`
    select url, count(*)::int as c
    from results
    where device_id = ${device_id}
      and ts >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
    group by url
    order by c desc
    limit 5
  `;
  const urlRows = toArray<{ url: string }>(urlsQ);
  const urls = urlRows.map((r) => r.url);

  const q = await sql`
    with buckets as (
      select
        url,
        to_timestamp(floor(extract(epoch from ts) / ${bucket_seconds}) * ${bucket_seconds}) at time zone 'utc' as bucket_ts,
        avg(case when success then latency_ms end) as avg_http_ms,
        avg(dns_ms) as avg_dns_ms
      from results
      where device_id = ${device_id}
        and ts >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
        and url = any(${urls})
      group by url, bucket_ts
      order by bucket_ts asc
    )
    select url, bucket_ts, avg_http_ms, avg_dns_ms
    from buckets
    order by bucket_ts asc
  `;
  const rows = toArray<any>(q);

  const series: Record<string, { ts_utc: string; http_ms: number | null; dns_ms: number | null }[]> = {};
  for (const u of urls) series[u] = [];

  for (const r of rows) {
    const u = r.url as string;
    if (!series[u]) series[u] = [];
    series[u].push({
      ts_utc: new Date(r.bucket_ts).toISOString(),
      http_ms: r.avg_http_ms === null ? null : Math.round(Number(r.avg_http_ms)),
      dns_ms: r.avg_dns_ms === null ? null : Math.round(Number(r.avg_dns_ms)),
    });
  }

  return NextResponse.json({
    ok: true,
    device_id,
    window_minutes,
    bucket_seconds,
    urls,
    series,
    fetched_at_utc: new Date().toISOString(),
  });
}
