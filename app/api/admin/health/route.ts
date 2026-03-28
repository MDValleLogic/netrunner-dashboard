import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdminSession } from "@/lib/requireAdminSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;

  const sql = neon(process.env.DATABASE_URL!);

  const [offlineDevices, heartbeatGaps, runnerFailures, unverifiedUsers] =
    await Promise.all([
      sql`
        SELECT
          d.device_id,
          d.nickname        AS device_name,
          d.last_ip         AS ip_address,
          d.last_seen,
          d.agent_version,
          t.name            AS tenant_name,
          u.email           AS owner_email,
          EXTRACT(EPOCH FROM (NOW() - d.last_seen)) / 3600 AS hours_offline
        FROM   devices d
        JOIN   tenants   t ON t.id = d.tenant_id
        LEFT   JOIN app_users u ON u.tenant_id = t.id
        WHERE  d.last_seen < NOW() - INTERVAL '1 hour'
          AND  d.status != 'provisioned'
        ORDER  BY d.last_seen ASC NULLS LAST
      `,
      sql`
        SELECT
          d.device_id,
          d.nickname        AS device_name,
          t.name            AS tenant_name,
          u.email           AS owner_email,
          d.last_seen,
          EXTRACT(EPOCH FROM (NOW() - d.last_seen)) / 60 AS minutes_since_last
        FROM   devices d
        JOIN   tenants   t ON t.id = d.tenant_id
        LEFT   JOIN app_users u ON u.tenant_id = t.id
        WHERE  d.last_seen BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '10 minutes'
        ORDER  BY d.last_seen ASC
      `,
      sql`
        SELECT
          d.device_id,
          d.nickname        AS device_name,
          t.name            AS tenant_name,
          COUNT(*)          AS failure_count,
          MAX(s.created_at) AS last_failure
        FROM   rf_scans s
        JOIN   devices d ON d.device_id = s.device_id
        JOIN   tenants t ON t.id = d.tenant_id
        WHERE  s.status = 'error'
          AND  s.created_at > NOW() - INTERVAL '24 hours'
        GROUP  BY d.device_id, d.nickname, t.name
        ORDER  BY failure_count DESC
        LIMIT  20
      `.catch(() => []),
      sql`
        SELECT
          u.email,
          t.name  AS tenant_name,
          u.created_at
        FROM   app_users u
        JOIN   tenants t ON t.id = u.tenant_id
        WHERE  u.email_verified = false
        ORDER  BY u.created_at DESC
      `,
    ]);

  const alerts = [];

  if (offlineDevices.length > 0) {
    alerts.push({
      level: "error",
      message: `${offlineDevices.length} device(s) offline for more than 1 hour`,
    });
  }
  if (unverifiedUsers.length > 0) {
    alerts.push({
      level: "warning",
      message: `${unverifiedUsers.length} user(s) with unverified email — may need manual DB fix`,
    });
  }
  if ((runnerFailures as unknown[]).length > 0) {
    alerts.push({
      level: "warning",
      message: `RF Runner errors detected on ${(runnerFailures as unknown[]).length} device(s) in the last 24h`,
    });
  }

  return NextResponse.json({
    alerts,
    offlineDevices,
    heartbeatGaps,
    runnerFailures,
    unverifiedUsers,
  });
}
