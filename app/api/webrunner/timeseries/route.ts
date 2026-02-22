import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "pi-001";

  // window_minutes controls time span, bucket_seconds controls granularity
  const window_minutes = Math.min(parseInt(searchParams.get("window_minutes") || "360", 10) || 360, 10080); // up to 7d
  const bucket_seconds = Math.min(parseInt(searchParams.get("bucket_seconds") || "60", 10) || 60, 3600); // 1m..1h

  // Optional url filter
  const url = (searchParams.get("url") || "").trim();

  // Bucket by time and compute avg latency for successful probes
  const q = await sql`
    with base as (
      select
        ts,
        latency_ms,
        success,
        url
      from results
      where device_id = ${device_id}
        and ts >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
        ${url ? sql`and url = ${url}` : sql``}
    ),
    bucketed as (
      select
        to_timestamp(floor(extract(epoch from ts) / ${bucket_seconds}) * ${bucket_seconds}) at time zone 'utc' as bucket_ts,
        avg(case when success then latency_ms end) as avg_latency_ms,
        count(*) as samples,
        sum(case when success then 1 else 0 end) as ok_samples,
        sum(case when success then 0 else 1 end) as fail_samples
      from base
      group by 1
      order by 1
    )
    select
      bucket_ts as ts_utc,
      avg_latency_ms,
      samples,
      ok_samples,
      fail_samples
    from bucketed
  `;

  const rows = toArray<AnyRow>(q);

  const points = rows.map((r) => ({
    ts_utc: r.ts_utc,
    avg_latency_ms: r.avg_latency_ms === null ? null : Number(r.avg_latency_ms),
    samples: Number(r.samples || 0),
    ok_samples: Number(r.ok_samples || 0),
    fail_samples: Number(r.fail_samples || 0),
  }));

  return NextResponse.json({
    ok: true,
    device_id,
    window_minutes,
    bucket_seconds,
    url: url || null,
    points,
    fetched_at_utc: new Date().toISOString(),
  });
}
