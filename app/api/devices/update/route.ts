import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const { device_id, nickname, site_name, location, address } = await req.json();
    if (!device_id) return NextResponse.json({ error: "device_id required" }, { status: 400 });

    await sql`
      UPDATE devices SET
        nickname   = ${nickname || null},
        site_name  = ${site_name || null},
        location   = ${location || null},
        address    = ${address || null},
        updated_at = NOW()
      WHERE device_id = ${device_id}
        AND tenant_id = ${tenantId}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
