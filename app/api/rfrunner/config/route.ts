import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const paramDeviceId = req.nextUrl.searchParams.get("device_id");
    let device_id: string;
    if (paramDeviceId) {
      device_id = paramDeviceId;
    } else {
      const devices = await sql`
        SELECT device_id FROM devices
        WHERE tenant_id = ${token.tenantId as string} AND status = 'claimed'
        ORDER BY last_seen DESC LIMIT 1
      ` as any[];
      if (!devices.length) return NextResponse.json({ config: null });
      device_id = devices[0].device_id;
    }

    const rows = await sql`
      SELECT * FROM rfrunner_config
      WHERE device_id = ${device_id}
    ` as any[];

    if (!rows.length) {
      // Return defaults if no config saved yet
      return NextResponse.json({
        config: {
          scan_enabled: true,
          scan_interval: 60,
          active_enabled: false,
          active_ssid: "",
          active_psk: "",
          active_interval: 1800,
        }
      });
    }

    return NextResponse.json({ config: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const bodyDeviceId = body?.device_id;
    let device_id: string;
    if (bodyDeviceId) {
      device_id = bodyDeviceId;
    } else {
      const devices = await sql`
        SELECT device_id FROM devices
        WHERE tenant_id = ${token.tenantId as string} AND status = 'claimed'
        ORDER BY last_seen DESC LIMIT 1
      ` as any[];
      if (!devices.length) return NextResponse.json({ error: "no device found" }, { status: 404 });
      device_id = devices[0].device_id;
    }
    const tenant_id = token.tenantId as string;
    const {
      scan_enabled = true,
      scan_interval = 60,
      active_enabled = false,
      active_ssid = "",
      active_psk = "",
      active_interval = 1800,
    } = body;

    await sql`
      INSERT INTO rfrunner_config
        (device_id, tenant_id, scan_enabled, scan_interval, active_enabled, active_ssid, active_psk, active_interval, updated_at)
      VALUES
        (${device_id}, ${tenant_id}, ${scan_enabled}, ${scan_interval}, ${active_enabled}, ${active_ssid}, ${active_psk}, ${active_interval}, now())
      ON CONFLICT (device_id) DO UPDATE SET
        scan_enabled    = EXCLUDED.scan_enabled,
        scan_interval   = EXCLUDED.scan_interval,
        active_enabled  = EXCLUDED.active_enabled,
        active_ssid     = EXCLUDED.active_ssid,
        active_psk      = EXCLUDED.active_psk,
        active_interval = EXCLUDED.active_interval,
        updated_at      = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
