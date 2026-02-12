import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "pi-001";
  const metric = (searchParams.get("metric") || "http") === "dns" ? "dns" : "http";
  const window_minutes = Math.min(parseInt(searchParams.get("window_minutes") || "15", 10) || 15, 240);
  const bucket_seconds = Math.min(parseInt(searchParams.get("bucket_seconds") || "10", 10) || 10, 300);

  const metricCol = metric === "dns" ? sql`dns_ms` : sql`http_ms`;

  const top = await sql`
    select url, count(*)::int as n
    from measurements
    where device_id = ${device_id}
      and ts_utc >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
    group by url
    order by n desc
    limit 5
  `;

  const urls = (top ?? []).map((r: any) => r.url as string);
  if (urls.length === 0) {
    return NextResponse.json({ ok: true, device_id, metric, urls: [], points: [] });
  }

  const rows = await sql`
    with base as (
      select url, ts_utc, ${metricCol} as v
      from measurements
      where device_id = ${device_id}
        and url = any(${urls})
        and ts_utc >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
        and ${metricCol} is not null
    ),
    buck as (
      select
        url,
        to_timestamp(floor(extract(epoch from ts_utc) / ${bucket_seconds}) * ${bucket_seconds}) at time zone 'utc' as bucket_utc,
        avg(v)::float as v
      from base
      group by url, bucket_utc
    )
    select url, bucket_utc as ts_utc, v
    from buck
    order by ts_utc asc
  `;

  return NextResponse.json({
    ok: true,
    device_id,
    metric,
    window_minutes,
    bucket_seconds,
    urls,
    points: rows ?? [],
    fetched_at_utc: new Date().toISOString(),
  });
}
