import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const devices = await sql`
      SELECT device_id, nr_serial, vlos_version, ip, hostname, claimed, last_seen
      FROM devices
      WHERE tenant_id = ${token.tenantId as string}
      ORDER BY last_seen DESC
    ` as any[];

    return NextResponse.json({ ok: true, devices });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
