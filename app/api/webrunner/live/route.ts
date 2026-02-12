import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // REAL security: require authenticated session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "pi-001";
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "50", 10) || 50,
    200
  );

  const devRows = await sql`
    select device_id, last_seen
    from devices
    where device_id = ${device_id}
    limit 1
  `;

  const measRows = await sql`
    select ts_utc, url, dns_ms, http_ms, http_err
    from measurements
    where device_id = ${device_id}
    order by ts_utc desc
    limit ${limit}
  `;

  return NextResponse.json({
    ok: true,
    device_id,
    device: devRows?.[0] ?? null,
    measurements: measRows ?? [],
    fetched_at_utc: new Date().toISOString(),
  });
}
