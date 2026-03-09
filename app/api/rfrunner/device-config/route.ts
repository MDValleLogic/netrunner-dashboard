import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const device_id = req.nextUrl.searchParams.get("device_id");
    if (!device_id) return NextResponse.json({ error: "device_id required" }, { status: 400 });

    const devices = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND claimed = true
      LIMIT 1
    ` as any[];
    if (!devices.length) return NextResponse.json({ error: "device not found" }, { status: 404 });

    const rows = await sql`
      SELECT * FROM rfrunner_config
      WHERE device_id = ${device_id}
    ` as any[];

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        config: { scan_enabled: true, scan_interval: 60, active_enabled: false, active_ssid: "", active_psk: "", active_interval: 1800 }
      });
    }

    return NextResponse.json({ ok: true, config: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
