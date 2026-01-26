import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const device_id = searchParams.get("device_id") || "pi-001";
  const limit = Math.min(
    500,
    Math.max(1, Number(searchParams.get("limit") || 200))
  );

  const { rows } = await sql`
    select device_id, ts_utc, url, dns_ms, http_ms, http_err
    from measurements
    where device_id = ${device_id}
    order by ts_utc desc
    limit ${limit}
  `;

  rows.reverse();

  return NextResponse.json({
    ok: true,
    device_id,
    count: rows.length,
    rows,
    build_tag: "a7c6ef8",
});
