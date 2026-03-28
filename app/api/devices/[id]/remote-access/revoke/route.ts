import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateMCPKey } from "@/lib/mcp/auth";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let tenantId: string;
    let closedBy: string;

    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const auth = await validateMCPKey(authHeader);
      if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      tenantId = auth.tenantId;
      closedBy = "mcp";
    } else {
      const { session, tenantId: tid } = await requireTenantSession();
      tenantId = tid;
      closedBy = (session.user as any)?.email ?? "unknown";
    }

    const { id: deviceId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason ?? "user_revoked";

    const devices = await sql`
      SELECT device_id, nickname, remote_access
      FROM devices
      WHERE device_id = ${deviceId}
      AND tenant_id = ${tenantId}
    ` as any[];

    if (!devices.length) {
      return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    }

    const device = devices[0];

    if (device.remote_access !== "active") {
      return NextResponse.json({ ok: false, error: "Remote access is not active" }, { status: 409 });
    }

    await sql`
      UPDATE remote_sessions
      SET closed_at = now(),
          closed_reason = ${reason},
          duration_seconds = EXTRACT(EPOCH FROM (now() - opened_at))::integer
      WHERE device_id = ${deviceId}
      AND closed_at IS NULL
    `;

    await sql`
      UPDATE devices
      SET remote_access = 'off',
          remote_access_expires_at = NULL,
          updated_at = now()
      WHERE device_id = ${deviceId}
    `;

    await sql`
      INSERT INTO pending_commands (device_id, tenant_id, command_type, payload, queued_by)
      VALUES (
        ${deviceId},
        ${tenantId},
        'run_script',
        ${{ script: "sudo bash /opt/vallelogic/tunnel-stop.sh" }},
        ${closedBy}
      )
    `;

    return NextResponse.json({
      ok: true,
      remote_access: "off",
      closed_by: closedBy,
      reason,
    });

  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
