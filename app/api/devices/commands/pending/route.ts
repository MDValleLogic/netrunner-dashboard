import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const device_id = req.nextUrl.searchParams.get("device_id");
    if (!device_id) {
      return NextResponse.json({ ok: false, error: "missing device_id" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, command_type, payload
      FROM pending_commands
      WHERE device_id = ${device_id}
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 5
    ` as any[];

    if (rows.length > 0) {
      await sql`
        UPDATE pending_commands
        SET status = 'executing', executed_at = now()
        WHERE id = ANY(${rows.map((r: any) => r.id)})
      `;
    }

    return NextResponse.json({ ok: true, commands: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
