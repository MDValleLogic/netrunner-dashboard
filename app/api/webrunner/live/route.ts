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
  const device_id     = searchParams.get("device_id") || "pi-001";
  const limit         = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
  const window_minutes = Math.min(parseInt(searchParams.get("window_minutes") || "60", 10) || 60, 1440);

  // Device info
  const devRows = toArray<AnyRow>(await sql`
    SELECT device_id, tenant_id, claimed, hostname, ip, mode, last_seen
    FROM devices
    WHERE device_id = ${device_id}
    LIMIT 1
  `);
  const device = devRows[0] ?? null;

  // Latest measurements from the correct table
  const measRows = toArray<AnyRow>(await sql`
    SELECT
      id,
      device_id,
      ts_utc,
      url,
      dns_ms,
      http_ms,
      http_status,
      http_err,
      CASE WHEN (http_err IS NULL OR http_err = '' OR http_err = 'null') THEN true ELSE false END AS success
    FROM measurements
    WHERE device_id = ${device_id}
      AND ts_utc >= NOW() - (${window_minutes}::int * '1 minute'::interval)
    ORDER BY ts_utc DESC
    LIMIT ${limit}
  `);

  return NextResponse.json({
    ok: true,
    device_id,
    window_minutes,
    limit,
    device,
    measurements: measRows,
    fetched_at_utc: new Date().toISOString(),
  });
}
