import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35; // Vercel max for Pro plan

export async function GET(req: NextRequest) {
  const device_id = req.nextUrl.searchParams.get("device_id");
  if (!device_id) {
    return NextResponse.json({ ok: false, error: "missing device_id" }, { status: 400 });
  }

  // Verify device key
  const device_key = req.headers.get("x-device-key");
  if (!device_key) {
    return NextResponse.json({ ok: false, error: "missing device key" }, { status: 401 });
  }

  const device = await sql`
    SELECT device_id FROM devices
    WHERE device_id = ${device_id}
    AND device_key_hash = encode(digest(${device_key}, 'sha256'), 'hex')
    LIMIT 1
  ` as any[];

  if (!device.length) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Long-poll: check every 2 seconds for up to 30 seconds
  const POLL_INTERVAL_MS = 2000;
  const MAX_WAIT_MS      = 30000;
  const started          = Date.now();

  while (Date.now() - started < MAX_WAIT_MS) {
    const rows = await sql`
      SELECT id, command_type, payload
      FROM pending_commands
      WHERE device_id = ${device_id}
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 5
    ` as any[];

    if (rows.length > 0) {
      // Mark as executing immediately
      await sql`
        UPDATE pending_commands
        SET status = 'executing', executed_at = now()
        WHERE id = ANY(${rows.map((r: any) => r.id)})
      `;
      return NextResponse.json({ ok: true, commands: rows });
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Timeout — return empty, Pi will immediately reconnect
  return NextResponse.json({ ok: true, commands: [] });
}
