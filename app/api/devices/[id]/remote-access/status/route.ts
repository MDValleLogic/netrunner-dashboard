import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateMCPKey } from "@/lib/mcp/auth";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let tenantId: string;

    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const auth = await validateMCPKey(authHeader);
      if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      tenantId = auth.tenantId;
    } else {
      const session = await requireTenantSession();
      tenantId = session.tenantId;
    }

    const { id: deviceId } = await params;

    // Get device remote access state
    const devices = await sql`
      SELECT device_id, nickname, remote_access, remote_access_expires_at
      FROM devices
      WHERE device_id = ${deviceId}
      AND tenant_id = ${tenantId}
    ` as any[];

    if (!devices.length) {
      return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    }

    const device = devices[0];

    // Auto-expire check — if active but past expiry, close it out
    if (
      device.remote_access === "active" &&
      device.remote_access_expires_at &&
      new Date(device.remote_access_expires_at) < new Date()
    ) {
      await sql`
        UPDATE devices
        SET remote_access = 'expired',
            updated_at = now()
        WHERE device_id = ${deviceId}
      `;

      await sql`
        UPDATE remote_sessions
        SET closed_at = now(),
            closed_reason = 'auto_expired',
            duration_seconds = EXTRACT(EPOCH FROM (now() - opened_at))::integer
        WHERE device_id = ${deviceId}
        AND closed_at IS NULL
      `;

      await sql`
        INSERT INTO pending_commands (device_id, tenant_id, command_type, payload, queued_by)
        VALUES (
          ${deviceId},
          ${tenantId},
          'run_script',
          ${{ script: "sudo systemctl stop cloudflared && echo 'cloudflared stopped'" }},
          'system_auto_expire'
        )
      `;

      device.remote_access = "expired";
    }

    // Get last 10 sessions for audit log
    const sessions = await sql`
      SELECT id, opened_by, opened_at, closed_at, closed_reason, duration_seconds
      FROM remote_sessions
      WHERE device_id = ${deviceId}
      ORDER BY opened_at DESC
      LIMIT 10
    ` as any[];

    // Calculate time remaining if active
    let secondsRemaining: number | null = null;
    if (device.remote_access === "active" && device.remote_access_expires_at) {
      secondsRemaining = Math.max(
        0,
        Math.floor((new Date(device.remote_access_expires_at).getTime() - Date.now()) / 1000)
      );
    }

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      nickname: device.nickname,
      remote_access: device.remote_access,
      expires_at: device.remote_access_expires_at,
      seconds_remaining: secondsRemaining,
      sessions,
    });

  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
