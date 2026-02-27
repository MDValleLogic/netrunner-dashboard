import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      device_id, nr_serial, cpu_serial, mac_eth0,
      hostname, ip, vlos_version, api_key
    } = body;

    if (!device_id || !nr_serial) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    // Upsert device — insert if new, update if exists
    await sql`
      INSERT INTO devices (
        id, nr_serial, cpu_serial, mac_eth0, hostname,
        ip_address, vlos_version, mode, claimed, last_seen
      ) VALUES (
        ${device_id}, ${nr_serial}, ${cpu_serial}, ${mac_eth0},
        ${hostname}, ${ip}, ${vlos_version}, 'cloud', false, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nr_serial    = EXCLUDED.nr_serial,
        mac_eth0     = EXCLUDED.mac_eth0,
        hostname     = EXCLUDED.hostname,
        ip_address   = EXCLUDED.ip_address,
        vlos_version = EXCLUDED.vlos_version,
        last_seen    = NOW()
    `;

    return NextResponse.json({
      ok: true,
      nr_serial,
      device_id,
      status: "registered"
    });

  } catch (e: any) {
    console.error("[REGISTER]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
