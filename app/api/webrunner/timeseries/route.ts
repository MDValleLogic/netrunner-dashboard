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
  const device_id      = searchParams.get("device_id") || "pi-001";
  const window_minutes = Math.min(parseInt(searchParams.get("window_minutes") || "360", 10) || 360, 10080);
  const bucket_seconds = Math.min(parseInt(searchParams.get("bucket_seconds") || "60",  10) || 60,  3600);
  const url            = (searchParams.get("url") || "").trim();

  const q = await sql`
    WITH base AS (
      SELECT
        ts_utc,
        http_ms AS latency_ms,
        CASE WHEN (http_err IS NULL OR http_err = '' OR http_err = 'null') THEN true ELSE false END AS success,
        url
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc >= NOW() - MAKE_INTERVAL(mins => ${window_minutes})
        ${url ? sql`AND url = ${url}` : sql``}
    ),
    bucketed AS (
      SELECT
        to_timestamp(floor(extract(epoch FROM ts_utc) / ${bucket_seconds}) * ${bucket_seconds}) AT TIME ZONE 'utc' AS bucket_ts,
        AVG(CASE WHEN success THEN latency_ms END)        AS avg_latency_ms,
        COUNT(*)                                           AS samples,
        SUM(CASE WHEN success     THEN 1 ELSE 0 END)      AS ok_samples,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)      AS fail_samples
      FROM base
      GROUP BY 1
      ORDER BY 1
    )
    SELECT
      bucket_ts   AS ts_utc,
      avg_latency_ms,
      samples,
      ok_samples,
      fail_samples
    FROM bucketed
  `;

  const rows = toArray<AnyRow>(q);

  const points = rows.map((r) => ({
    ts_utc:         r.ts_utc,
    avg_latency_ms: r.avg_latency_ms === null ? null : Number(r.avg_latency_ms),
    samples:        Number(r.samples     || 0),
    ok_samples:     Number(r.ok_samples  || 0),
    fail_samples:   Number(r.fail_samples || 0),
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
