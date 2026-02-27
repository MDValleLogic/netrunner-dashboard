import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { nr_serial } = await req.json();
    if (!nr_serial) return NextResponse.json({ ok: false, error: "missing nr_serial" }, { status: 400 });

    const rows = await sql`
      SELECT device_id, nr_serial, vlos_version, ip, hostname, last_seen
      FROM devices
      WHERE nr_serial = ${nr_serial.toUpperCase()} AND claimed = false
    ` as any[];

    if (!rows.length) return NextResponse.json({ ok: false, error: "Device not found or already claimed" }, { status: 404 });

    const device = rows[0];

    await sql`
      UPDATE devices SET
        claimed    = true,
        tenant_id  = ${token.tenantId as string},
        claimed_at = NOW(),
        claimed_by = ${token.id as string}
      WHERE device_id = ${device.device_id}
    `;

    return NextResponse.json({ ok: true, device });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
