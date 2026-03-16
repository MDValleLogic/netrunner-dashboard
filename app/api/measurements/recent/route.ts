import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export const runtime = "nodejs";

function getRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession();

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("device_id") || "";
    const limitRaw = searchParams.get("limit") || "20";
    const limit = Math.max(1, Math.min(200, Number(limitRaw) || 20));

    let result: any;

    if (deviceId) {
      const check = await sql`
        SELECT device_id FROM devices
        WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}
        LIMIT 1
      ` as any[];
      if (!check.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

      result = await sql`
        SELECT ts_utc, url, dns_ms, http_ms, http_err
        FROM measurements
        WHERE device_id = ${deviceId}
        ORDER BY ts_utc DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT m.ts_utc, m.url, m.dns_ms, m.http_ms, m.http_err, m.device_id
        FROM measurements m
        JOIN devices d ON d.device_id = m.device_id
        WHERE d.tenant_id = ${tenantId}
        ORDER BY m.ts_utc DESC
        LIMIT ${limit}
      `;
    }

    const rows = getRows(result);
    return NextResponse.json({ ok: true, device_id: deviceId || null, limit, rows });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
