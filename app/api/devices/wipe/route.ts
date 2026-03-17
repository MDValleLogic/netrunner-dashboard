import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/requireTenantSession";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { tenantId } = await requireTenantSession();

  const body = await req.json();
  const { device_id, runners } = body;

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  const check = await sql`
    SELECT device_id, nr_serial FROM devices
    WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (check.length === 0) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  const wipeAll = !runners || runners.includes("all");
  const deleted: Record<string, number> = {};

  if (wipeAll || runners.includes("webrunner")) {
    const r = await sql`DELETE FROM measurements WHERE device_id = ${device_id}` as any;
    deleted.measurements = r.length ?? 0;
  }
  if (wipeAll || runners.includes("speedrunner")) {
    const r = await sql`DELETE FROM speed_results WHERE device_id = ${device_id}` as any;
    deleted.speed_results = r.length ?? 0;
  }
  if (wipeAll || runners.includes("rfrunner")) {
    await sql`DELETE FROM rf_scans WHERE device_id = ${device_id}`;
    await sql`DELETE FROM rf_scans_hourly WHERE device_id = ${device_id}`;
    deleted.rf_scans = 1;
  }
  if (wipeAll || runners.includes("routerunner")) {
    await sql`DELETE FROM route_hops WHERE device_id = ${device_id}`;
    await sql`DELETE FROM route_traces WHERE device_id = ${device_id}`;
    deleted.route_traces = 1;
  }
  if (wipeAll || runners.includes("results")) {
    await sql`DELETE FROM results WHERE device_id = ${device_id}`;
    deleted.results = 1;
  }
  if (wipeAll || runners.includes("heartbeats")) {
    await sql`DELETE FROM device_heartbeats WHERE device_id = ${device_id}`;
    deleted.device_heartbeats = 1;
  }

  return NextResponse.json({
    ok: true,
    message: `Data wiped for ${check[0].nr_serial}`,
    nr_serial: check[0].nr_serial,
    deleted,
  });
}
