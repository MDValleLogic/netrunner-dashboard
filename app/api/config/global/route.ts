import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
import { validateMCPKey } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

const RUNNER_TYPES = ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"];

const RUNNER_DEFAULTS: Record<string, object> = {
  speedrunner: { interval_seconds: 3600, regions: ["Northeast US", "Southeast US", "Midwest US", "West Coast US", "Europe", "Asia Pacific"] },
  blerunner:   { scan_enabled: true, scan_interval: 60 },
  rfrunner:    { scan_enabled: true, scan_interval: 60, active_enabled: false, active_ssid: "", active_psk: "", active_interval: 1800 },
  webrunner:   { urls: ["https://www.google.com/generate_204"], interval_seconds: 300, timeout_seconds: 10 },
  routerunner: { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 },
};

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

// GET /api/config/global?runner=speedrunner  — all runners if no filter
export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const runner = req.nextUrl.searchParams.get("runner");

    if (runner) {
      if (!RUNNER_TYPES.includes(runner)) {
        return NextResponse.json({ ok: false, error: "invalid runner_type" }, { status: 400 });
      }
      const rows = await sql`
        SELECT runner_type, config, updated_at, updated_by
        FROM global_runner_config
        WHERE tenant_id = ${tenantId}::uuid AND runner_type = ${runner}
        LIMIT 1
      ` as any[];

      const config = rows.length ? rows[0].config : RUNNER_DEFAULTS[runner];
      const source = rows.length ? "global" : "default";
      return NextResponse.json({ ok: true, runner_type: runner, config, source, updated_at: rows[0]?.updated_at ?? null });
    }

    // Return all runners
    const rows = await sql`
      SELECT runner_type, config, updated_at, updated_by
      FROM global_runner_config
      WHERE tenant_id = ${tenantId}::uuid
    ` as any[];

    const configMap: Record<string, object> = {};
    const sourceMap: Record<string, string> = {};

    for (const runner of RUNNER_TYPES) {
      const row = rows.find((r: any) => r.runner_type === runner);
      configMap[runner] = row ? row.config : RUNNER_DEFAULTS[runner];
      sourceMap[runner] = row ? "global" : "default";
    }

    return NextResponse.json({ ok: true, configs: configMap, sources: sourceMap });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/config/global — upsert global config for a runner
export async function POST(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { runner_type, config } = body;

    if (!runner_type || !RUNNER_TYPES.includes(runner_type)) {
      return NextResponse.json({ ok: false, error: "invalid runner_type" }, { status: 400 });
    }
    if (!config || typeof config !== "object") {
      return NextResponse.json({ ok: false, error: "config object required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO global_runner_config (tenant_id, runner_type, config, updated_at, updated_by)
      VALUES (${tenantId}::uuid, ${runner_type}, ${JSON.stringify(config)}::jsonb, NOW(), 'user')
      ON CONFLICT (tenant_id, runner_type) DO UPDATE SET
        config     = EXCLUDED.config,
        updated_at = NOW(),
        updated_by = 'user'
      RETURNING runner_type, config, updated_at
    ` as any[];

    return NextResponse.json({ ok: true, runner_type, config: rows[0].config, updated_at: rows[0].updated_at });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
