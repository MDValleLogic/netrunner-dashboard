import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const RUNNER_TYPES = ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"];

const RUNNER_DEFAULTS: Record<string, object> = {
  speedrunner: { interval_seconds: 3600, regions: ["Northeast US", "Southeast US", "Midwest US", "West Coast US", "Europe", "Asia Pacific"] },
  blerunner:   { scan_enabled: true, scan_interval: 60 },
  rfrunner:    { scan_enabled: true, scan_interval: 60, active_enabled: false, active_ssid: "", active_psk: "", active_interval: 1800 },
  webrunner:   { urls: ["https://www.google.com/generate_204"], interval_seconds: 300, timeout_seconds: 10 },
  routerunner: { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 },
};

// Dual auth: session token OR device key header (Pi-facing)
async function resolveIds(req: NextRequest): Promise<{ tenantId: string; deviceId: string } | null> {
  const deviceKey = req.headers.get("x-device-key") ?? "";
  const deviceId  = req.headers.get("x-device-id") ?? "";

  if (deviceKey && deviceId) {
    const hash = crypto.createHash("sha256").update(deviceKey).digest("hex");
    const rows = await sql`
      SELECT device_id, tenant_id FROM devices
      WHERE device_id = ${deviceId}
        AND device_key_hash = ${hash}
        AND status = 'claimed'
      LIMIT 1
    ` as any[];
    if (rows.length) return { tenantId: rows[0].tenant_id, deviceId: rows[0].device_id };
  }

  return null;
}

// GET /api/config/resolved/[device_id]
// Pi calls this at heartbeat — server resolves global vs device override, Pi gets one clean config per runner
export async function GET(req: NextRequest, { params }: { params: Promise<{ device_id: string }> }) {
  try {
    const ids = await resolveIds(req);
    if (!ids) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { tenantId, deviceId } = ids;

    // Fetch global configs for this tenant
    const globalRows = await sql`
      SELECT runner_type, config FROM global_runner_config
      WHERE tenant_id = ${tenantId}::uuid
    ` as any[];

    // Fetch device overrides
    const deviceRows = await sql`
      SELECT runner_type, config FROM device_runner_config
      WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}::uuid
    ` as any[];

    const globalMap  = Object.fromEntries(globalRows.map((r: any) => [r.runner_type, r.config]));
    const deviceMap  = Object.fromEntries(deviceRows.map((r: any) => [r.runner_type, r.config]));

    const resolved: Record<string, { config: object; source: string }> = {};

    for (const runner of RUNNER_TYPES) {
      if (deviceMap[runner]) {
        resolved[runner] = { config: deviceMap[runner], source: "device" };
      } else if (globalMap[runner]) {
        resolved[runner] = { config: globalMap[runner], source: "global" };
      } else {
        resolved[runner] = { config: RUNNER_DEFAULTS[runner], source: "default" };
      }
    }

    return NextResponse.json({ ok: true, device_id: deviceId, resolved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
