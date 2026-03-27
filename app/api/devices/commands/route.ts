import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyMcpAuth } from "@/lib/mcp/auth";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function POST(req: NextRequest) {
  try {
    let tenantId: string;

    // Accept either MCP bearer token OR NextAuth session
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const auth = await verifyMcpAuth(req);
      if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      tenantId = auth.tenantId;
    } else {
      const session = await requireTenantSession();
      tenantId = session.tenantId;
    }

    const { device_id, command_type, payload = {} } = await req.json();

    if (!device_id || !command_type) {
      return NextResponse.json({ ok: false, error: "missing device_id or command_type" }, { status: 400 });
    }

    const valid = ["run_script", "update_file", "restart_service", "reboot"];
    if (!valid.includes(command_type)) {
      return NextResponse.json({ ok: false, error: "invalid command_type" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO pending_commands (device_id, tenant_id, command_type, payload)
      VALUES (${device_id}, ${tenantId}, ${command_type}, ${JSON.stringify(payload)})
      RETURNING id, status, created_at
    ` as any[];

    return NextResponse.json({ ok: true, command: rows[0] });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
