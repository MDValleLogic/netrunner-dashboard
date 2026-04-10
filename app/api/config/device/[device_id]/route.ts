import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
import { validateMCPKey } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

const RUNNER_TYPES = ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"];

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const auth = await validateMCPKey(authHeader);
    return auth ? auth.tenantId : null;
  }
  try {
    const { tenantId } = await requireTenantSession();
    return tenantId;
  } catch {
    return null;
  }
}

// GET /api/config/device/[device_id] — all overrides for a device, with config_source per runner
export async function GET(req: NextRequest, { params }: { params: { device_id: string } }) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { device_id } = params;

    // Verify device belongs to tenant
    const deviceCheck = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}::uuid
      LIMIT 1
    ` as any[];
    if (!deviceCheck.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

    const runner = req.nextUrl.searchParams.get("runner");

    const rows = await sql`
      SELECT runner_type, config, updated_at, updated_by
      FROM device_runner_config
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}::uuid
      ${runner ? sql`AND runner_type = ${runner}` : sql``}
    ` as any[];

    if (runner) {
      const row = rows.find((r: any) => r.runner_type === runner);
      return NextResponse.json({
        ok: true,
        device_id,
        runner_type: runner,
        config: row?.config ?? null,
        config_source: row ? "device" : "global",
        updated_at: row?.updated_at ?? null,
      });
    }

    // Return all runners with source badges
    const overrideMap: Record<string, any> = {};
    for (const row of rows) {
      overrideMap[row.runner_type] = { config: row.config, config_source: "device", updated_at: row.updated_at };
    }
    for (const rt of RUNNER_TYPES) {
      if (!overrideMap[rt]) overrideMap[rt] = { config: null, config_source: "global", updated_at: null };
    }

    return NextResponse.json({ ok: true, device_id, runners: overrideMap });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/config/device/[device_id] — create or update a device override
export async function POST(req: NextRequest, { params }: { params: { device_id: string } }) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { device_id } = params;

    const deviceCheck = await sql`
      SELECT device_id FROM devices
      WHERE device_id = ${device_id} AND tenant_id = ${tenantId}::uuid
      LIMIT 1
    ` as any[];
    if (!deviceCheck.length) return NextResponse.json({ ok: false, error: "device not found" }, { status: 403 });

    const body = await req.json();
    const { runner_type, config } = body;

    if (!runner_type || !RUNNER_TYPES.includes(runner_type)) {
      return NextResponse.json({ ok: false, error: "invalid runner_type" }, { status: 400 });
    }
    if (!config || typeof config !== "object") {
      return NextResponse.json({ ok: false, error: "config object required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO device_runner_config (device_id, tenant_id, runner_type, config, updated_at, updated_by)
      VALUES (${device_id}, ${tenantId}::uuid, ${runner_type}, ${JSON.stringify(config)}::jsonb, NOW(), 'user')
      ON CONFLICT (device_id, runner_type) DO UPDATE SET
        config     = EXCLUDED.config,
        updated_at = NOW(),
        updated_by = 'user'
      RETURNING runner_type, config, updated_at
    ` as any[];

    return NextResponse.json({ ok: true, device_id, runner_type, config: rows[0].config, config_source: "device", updated_at: rows[0].updated_at });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/config/device/[device_id]?runner=speedrunner — reset to global
export async function DELETE(req: NextRequest, { params }: { params: { device_id: string } }) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { device_id } = params;
    const runner_type = req.nextUrl.searchParams.get("runner");

    if (!runner_type || !RUNNER_TYPES.includes(runner_type)) {
      return NextResponse.json({ ok: false, error: "runner query param required" }, { status: 400 });
    }

    await sql`
      DELETE FROM device_runner_config
      WHERE device_id = ${device_id}
        AND tenant_id = ${tenantId}::uuid
        AND runner_type = ${runner_type}
    `;

    return NextResponse.json({ ok: true, device_id, runner_type, config_source: "global", message: "Device override removed — now using global config" });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
