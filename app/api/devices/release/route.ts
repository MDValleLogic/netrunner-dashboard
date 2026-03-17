import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/requireTenantSession";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { tenantId } = await requireTenantSession();

  const body = await req.json();
  const { device_id } = body;

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  const check = await sql`
    SELECT device_id, nr_serial FROM devices
    WHERE device_id = ${device_id} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (check.length === 0) {
    return NextResponse.json({ ok: false, error: "Device not found or does not belong to your account" }, { status: 404 });
  }

  // Wipe ALL data and config associated with this device
  await sql`DELETE FROM measurements    WHERE device_id = ${device_id}`;
  await sql`DELETE FROM speed_results   WHERE device_id = ${device_id}`;
  await sql`DELETE FROM rf_scans        WHERE device_id = ${device_id}`;
  await sql`DELETE FROM rf_scans_hourly WHERE device_id = ${device_id}`;
  await sql`DELETE FROM wifi_tests      WHERE device_id = ${device_id}`;
  await sql`DELETE FROM route_hops      WHERE device_id = ${device_id}`;
  await sql`DELETE FROM route_traces    WHERE device_id = ${device_id}`;
  await sql`DELETE FROM results         WHERE device_id = ${device_id}`;
  await sql`DELETE FROM device_heartbeats WHERE device_id = ${device_id}`;
  await sql`DELETE FROM device_claims   WHERE device_id = ${device_id}`;
  await sql`DELETE FROM device_urls     WHERE device_id = ${device_id}`;
  await sql`DELETE FROM device_config   WHERE device_id = ${device_id}`;
  await sql`DELETE FROM rfrunner_config WHERE device_id = ${device_id}`;

  // Release device — clear tenant, reset to unclaimed, clear all metadata
  await sql`
    UPDATE devices SET
      tenant_id  = NULL,
      status     = 'unclaimed',
      claimed_at = NULL,
      claimed_by = NULL,
      nickname   = NULL,
      site_name  = NULL,
      location   = NULL,
      address    = NULL,
      lat        = NULL,
      lng        = NULL,
      notes      = NULL
    WHERE device_id = ${device_id}
  `;

  return NextResponse.json({
    ok: true,
    message: `Device ${check[0].nr_serial} released and all data wiped.`,
    nr_serial: check[0].nr_serial,
  });
}
