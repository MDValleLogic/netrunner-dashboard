import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";

// ── GET — Poll for command result ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id     = req.nextUrl.searchParams.get("id");
  const recent = req.nextUrl.searchParams.get("recent");

  const tenantId = (session.user as any).tenantId;

  // Return last N commands for this tenant (page mount persistence)
  if (!id && recent) {
    const limit = Math.min(parseInt(recent) || 5, 20);
    const rows = await sql`
      SELECT id, device_id, command_type, payload, status, created_at, completed_at, output, error
      FROM pending_commands
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    ` as any[];
    return NextResponse.json({ ok: true, commands: rows });
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const rows = await sql`
    SELECT id, command_type, payload, status, created_at, executed_at, completed_at, output, error
    FROM pending_commands
    WHERE id = ${id} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "Command not found" }, { status: 404 });

  const cmd = rows[0];
  return NextResponse.json({
    id:           cmd.id,
    type:         cmd.command_type,
    status:       cmd.status,
    output:       cmd.output ?? cmd.error ?? null,
    started_at:   cmd.created_at,
    completed_at: cmd.completed_at ?? null,
  });
}

// ── POST — Queue a new command ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { device_id, command_type, payload } = body;

  if (!device_id || !command_type) {
    return NextResponse.json({ error: "Missing device_id or command_type" }, { status: 400 });
  }

  const valid = ["run_cli_command", "run_snmp_get", "run_network_discovery"];
  if (!valid.includes(command_type)) {
    return NextResponse.json({ error: `Invalid command_type. Must be one of: ${valid.join(", ")}` }, { status: 400 });
  }

  // Verify device belongs to this tenant
  const device = await sql`
    SELECT device_id FROM devices
    WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (device.length === 0) {
    return NextResponse.json({ error: "Device not found or not in your tenant" }, { status: 404 });
  }

  // Queue the command
  const rows = await sql`
    INSERT INTO pending_commands (device_id, tenant_id, command_type, payload, status)
    VALUES (${device_id}, ${tenantId}, ${command_type}, ${JSON.stringify(payload ?? {})}, 'pending')
    RETURNING id, status, created_at
  ` as any[];

  const cmd = rows[0];
  return NextResponse.json({
    ok:         true,
    command_id: cmd.id,
    status:     cmd.status,
    queued_at:  cmd.created_at,
  });
}
