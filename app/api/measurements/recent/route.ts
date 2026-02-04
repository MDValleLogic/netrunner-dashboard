import { requireTenantSession } from "@/lib/requireTenantSession";
import { setTenantScope } from "@/lib/tenantScope";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // ✅ Require login + set tenant scope for RLS
  const { tenantId } = await requireTenantSession();
  await setTenantScope(tenantId);

  const { searchParams } = new URL(req.url);

  const device_id = searchParams.get("device_id") || "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "50"), 1), 200);

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  try {
    // ✅ neon(sql) returns an ARRAY of rows
    const rows = await sql`
      select device_id, ts_utc, url, dns_ms, http_ms, http_err
      from measurements
      where device_id = ${device_id}
      order by ts_utc desc
      limit ${limit}
    `;

    return NextResponse.json({
      ok: true,
      device_id,
      count: (rows as any[]).length,
      rows,
      build_tag: "a7c6ef8",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "DB query failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

