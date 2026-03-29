import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, session } = await requireTenantSession();

    const { nr_serial } = await req.json();
    if (!nr_serial) return NextResponse.json({ ok: false, error: "missing nr_serial" }, { status: 400 });

    const rows = await sql`
      SELECT device_id, nr_serial, agent_version, last_ip, last_seen
      FROM devices
      WHERE nr_serial = ${nr_serial.toUpperCase()} AND status IN ('unclaimed', 'provisioned')
    ` as any[];

    if (!rows.length) return NextResponse.json({ ok: false, error: "Device not found or already claimed" }, { status: 404 });

    const device = rows[0];

    await sql`
      UPDATE devices SET
        status     = 'claimed',
        tenant_id  = ${tenantId},
        claimed_at = NOW(),
        claimed_by = ${(session.user as any).id as string},
        updated_at = NOW()
      WHERE device_id = ${device.device_id}
    `;

    return NextResponse.json({ ok: true, device });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
