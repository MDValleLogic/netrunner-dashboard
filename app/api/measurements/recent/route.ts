import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const device_id = searchParams.get("device_id") || "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "50"), 1), 200);

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  const result = await sql`
    SELECT device_id, ts_utc, url, dns_ms, http_ms, http_err
    FROM measurements
    WHERE device_id = ${device_id}
    ORDER BY ts_utc DESC
    LIMIT ${limit};
  `;

  const rows = result.rows ?? [];

  return NextResponse.json({
    ok: true,
    device_id,
    count: rows.length,
    rows,
    build_tag: "a7c6ef8",
  });
}
