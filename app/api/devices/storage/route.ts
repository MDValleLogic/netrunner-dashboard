import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/requireTenantSession";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { tenantId } = await requireTenantSession();

  // Per-device row counts and estimated sizes for data tables
  const deviceStats = await sql`
    SELECT
      d.device_id,
      d.nickname,
      d.nr_serial,
      (SELECT COUNT(*) FROM measurements      WHERE device_id = d.device_id)::int AS measurements_rows,
      (SELECT COUNT(*) FROM speed_results     WHERE device_id = d.device_id)::int AS speed_rows,
      (SELECT COUNT(*) FROM rf_scans          WHERE device_id = d.device_id)::int AS rf_rows,
      (SELECT COUNT(*) FROM rf_scans_hourly   WHERE device_id = d.device_id)::int AS rf_hourly_rows,
      (SELECT COUNT(*) FROM route_traces      WHERE device_id = d.device_id)::int AS route_rows,
      (SELECT COUNT(*) FROM route_hops        WHERE device_id = d.device_id)::int AS hop_rows,
      (SELECT COUNT(*) FROM results           WHERE device_id = d.device_id)::int AS results_rows,
      (SELECT COUNT(*) FROM device_heartbeats WHERE device_id = d.device_id)::int AS heartbeat_rows
    FROM devices d
    WHERE d.tenant_id = ${tenantId}
    ORDER BY d.nickname
  ` as any[];

  // Table sizes from pg_total_relation_size
  const tableSizes = await sql`
    SELECT
      relname AS table_name,
      pg_total_relation_size(relid) AS bytes,
      pg_size_pretty(pg_total_relation_size(relid)) AS pretty_size,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE relname IN (
      'measurements', 'speed_results', 'rf_scans', 'rf_scans_hourly',
      'route_traces', 'route_hops', 'results', 'device_heartbeats',
      'devices', 'tenants', 'app_users', 'mcp_api_keys', 'wifi_tests'
    )
    ORDER BY bytes DESC
  ` as any[];

  // Total DB size
  const totalSize = await sql`
    SELECT
      pg_size_pretty(SUM(pg_total_relation_size(relid))) AS total_pretty,
      SUM(pg_total_relation_size(relid)) AS total_bytes
    FROM pg_stat_user_tables
  ` as any[];

  return NextResponse.json({
    ok: true,
    total: totalSize[0],
    tables: tableSizes,
    devices: deviceStats,
  });
}
