import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/requireTenantSession";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { tenantId } = await requireTenantSession();

  const body = await req.json();
  const { device_id } = body;

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  // Verify device belongs to this tenant before releasing
  const check = await sql`
    SELECT device_id, nr_serial, nickname
    FROM devices
    WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (check.length === 0) {
    return NextResponse.json({ ok: false, error: "Device not found or does not belong to your account" }, { status: 404 });
  }

  // Release: clear tenant association, reset to unclaimed
  await sql`
    UPDATE devices
    SET
      tenant_id  = NULL,
      status     = 'unclaimed',
      claimed_at = NULL,
      claimed_by = NULL
    WHERE device_id = ${device_id}
  `;

  return NextResponse.json({
    ok: true,
    message: `Device ${check[0].nr_serial} released. It can now be claimed by another account.`,
    nr_serial: check[0].nr_serial,
  });
}
