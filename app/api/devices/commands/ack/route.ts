import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { command_id, status, output, error } = await req.json();

    if (!command_id || !status) {
      return NextResponse.json({ ok: false, error: "missing command_id or status" }, { status: 400 });
    }

    if (!["complete", "failed"].includes(status)) {
      return NextResponse.json({ ok: false, error: "status must be complete or failed" }, { status: 400 });
    }

    await sql`
      UPDATE pending_commands
      SET
        status       = ${status},
        completed_at = now(),
        output       = ${output ?? null},
        error        = ${error ?? null}
      WHERE id = ${command_id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
