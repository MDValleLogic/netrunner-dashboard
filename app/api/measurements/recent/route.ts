import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function getRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const deviceId = searchParams.get("device_id") || "";
    const limitRaw = searchParams.get("limit") || "20";
    const limit = Math.max(1, Math.min(200, Number(limitRaw) || 20));

    let result: any;

    if (deviceId) {
      result = await sql`
        select ts_utc, url, dns_ms, http_ms, http_err
        from measurements
        where device_id = ${deviceId}
        order by ts_utc desc
        limit ${limit}
      `;
    } else {
      result = await sql`
        select ts_utc, url, dns_ms, http_ms, http_err, device_id
        from measurements
        order by ts_utc desc
        limit ${limit}
      `;
    }

    const rows = getRows(result);

    return NextResponse.json({
      ok: true,
      device_id: deviceId || null,
      limit,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

