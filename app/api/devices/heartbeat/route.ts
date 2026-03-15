import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, ip, hostname, uptime_seconds, agent_version } = body || {};
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    await sql`
      UPDATE devices SET
        last_seen     = NOW(),
        last_ip       = COALESCE(${ip || null}, last_ip),
        agent_version = COALESCE(${agent_version || null}, agent_version),
        updated_at    = NOW()
      WHERE device_id = ${device_id} AND status = 'claimed'
    `;

    await sql`
      INSERT INTO device_heartbeats (device_id, ip, hostname, uptime_s, agent_ver, ok)
      VALUES (${device_id}, ${ip || null}, ${hostname || null}, ${uptime_seconds || null}, ${agent_version || null}, true)
    `;

    // Keep only last 200 heartbeats per device
    await sql`
      DELETE FROM device_heartbeats
      WHERE device_id = ${device_id}
        AND id NOT IN (
          SELECT id FROM device_heartbeats
          WHERE device_id = ${device_id}
          ORDER BY ts_utc DESC
          LIMIT 200
        )
    `;

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const device_id = searchParams.get("device_id");
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const rows = await sql`
      SELECT ts_utc, ip, hostname, uptime_s, agent_ver, ok
      FROM device_heartbeats
      WHERE device_id = ${device_id}
      ORDER BY ts_utc DESC
      LIMIT 96
    ` as any[];

    return NextResponse.json({ ok: true, heartbeats: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
