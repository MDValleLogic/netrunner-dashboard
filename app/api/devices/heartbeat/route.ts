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

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
