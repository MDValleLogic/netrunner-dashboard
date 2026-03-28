import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateMCPKey } from "@/lib/mcp/auth";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let tenantId: string;
    let openedBy: string;

    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const auth = await validateMCPKey(authHeader);
      if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      tenantId = auth.tenantId;
      openedBy = "mcp";
    } else {
      const session = await requireTenantSession();
      tenantId = session.tenantId;
      openedBy = session.user?.email ?? "unknown";
    }

    const { id: deviceId } = await params;

    // Verify device belongs to this tenant
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

    if (device.remote_access === "active") {
      return NextResponse.json({ ok: false, error: "Remote access already active" }, { status: 409 });
    }

    // Set expiry 4 hours from now
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    // Update device remote_access state
    await sql`
      UPDATE devices
      SET remote_access = 'active',
          remote_access_expires_at = ${expiresAt},
          updated_at = now()
      WHERE device_id = ${deviceId}
    `;

    // Log session
    const sessions = await sql`
      INSERT INTO remote_sessions (device_id, tenant_id, opened_by, opened_at)
      VALUES (${deviceId}, ${tenantId}, ${openedBy}, now())
      RETURNING id, opened_at
    ` as any[];

    const sessionId = sessions[0].id;

    // Queue cloudflared start via Pending Commands
    await sql`
      INSERT INTO pending_commands (device_id, tenant_id, command_type, payload, queued_by)
      VALUES (
        ${deviceId},
        ${tenantId},
        'run_script',
        ${{ script: "sudo systemctl start cloudflared && echo 'cloudflared started'" }},
        ${openedBy}
      )
    `;

    // Send confirmation email
    if (openedBy !== "mcp") {
      await resend.emails.send({
        from: "ValleLogic <hello@vallelogic.com>",
        to: openedBy,
        subject: `Remote Support Access Enabled — ${device.nickname ?? deviceId}`,
        html: `
          <p>Hello,</p>
          <p>Remote support access has been enabled for device <strong>${device.nickname ?? deviceId}</strong>.</p>
          <ul>
            <li><strong>Enabled by:</strong> ${openedBy}</li>
            <li><strong>Enabled at:</strong> ${new Date().toUTCString()}</li>
            <li><strong>Auto-expires at:</strong> ${new Date(expiresAt).toUTCString()}</li>
          </ul>
          <p>You can revoke access at any time from your <a href="https://app.vallelogic.com/devices">Device Management</a> page.</p>
          <p>— ValleLogic Platform</p>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      remote_access: "active",
      expires_at: expiresAt,
    });

  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
