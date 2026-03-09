import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Device-key authenticated endpoint — used by Pi to fetch its own RF config
export async function GET(req: NextRequest) {
  try {
    const deviceKey = req.headers.get("x-device-key");
    if (!deviceKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Look up device by key
    const devices = await sql`
      SELECT device_id FROM devices
      WHERE device_key = ${deviceKey} AND claimed = true
      LIMIT 1
    ` as any[];
    if (!devices.length) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const device_id = devices[0].device_id;

    const rows = await sql`
      SELECT * FROM rfrunner_config
      WHERE device_id = ${device_id}
    ` as any[];

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
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

    return NextResponse.json({ ok: true, config: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
