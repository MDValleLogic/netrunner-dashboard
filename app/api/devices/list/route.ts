import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();

    const devices = await sql`
      SELECT device_id, nr_serial, agent_version, last_ip, nickname, site_name,
             location, status, last_seen, address, lat, lng
      FROM devices
      WHERE tenant_id = ${tenantId}
      ORDER BY last_seen DESC
    ` as any[];

    return NextResponse.json({ ok: true, devices });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
