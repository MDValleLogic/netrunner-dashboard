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
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
  const window_minutes = Math.min(parseInt(searchParams.get("window_minutes") || "60", 10) || 60, 1440);

  const devQ = await sql`
    select
      device_id,
      tenant_id,
      claimed,
      claim_code_sha256,
      hostname,
      ip,
      mode,
      last_seen
    from devices
    where device_id = ${device_id}
    limit 1
  `;
  const devRows = toArray<AnyRow>(devQ);
  const device = devRows[0] ?? null;

  // Pull most recent results
  const resQ = await sql`
    select
      id,
      device_id,
      ts as ts_utc,
      url,
      latency_ms as http_ms,
      case when success then null else coalesce(error,'') end as http_err,
      success
    from results
    where device_id = ${device_id}
      and ts >= (now() at time zone 'utc') - (${window_minutes} || ' minutes')::interval
    order by ts desc
    limit ${limit}
  `;
  const measurements = toArray<AnyRow>(resQ);

  return NextResponse.json({
    ok: true,
    device_id,
    window_minutes,
    limit,
    device,
    measurements,
    fetched_at_utc: new Date().toISOString(),
  });
}
