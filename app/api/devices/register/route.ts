import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, nr_serial, ip, agent_version } = body;

    if (!device_id || !nr_serial) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    await sql`
      INSERT INTO devices (device_id, nr_serial, cpu_serial_hash, status, last_ip, agent_version)
      VALUES (
        ${device_id}, ${nr_serial}, ${device_id},
        'unclaimed', ${ip || null}, ${agent_version || null}
      )
      ON CONFLICT (device_id) DO UPDATE SET
        last_ip       = EXCLUDED.last_ip,
        agent_version = EXCLUDED.agent_version,
        last_seen     = NOW(),
        updated_at    = NOW()
    `;

    return NextResponse.json({ ok: true, nr_serial, device_id, status: "registered" });

  } catch (e: any) {
    console.error("[REGISTER]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
