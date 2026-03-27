import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdminSession } from "@/lib/requireAdminSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;

  const sql = neon(process.env.DATABASE_URL!);

  const [tenants, deviceSummary, recentActivity, platformTotals] =
    await Promise.all([
      sql`
        SELECT
          t.id                                    AS tenant_id,
          t.name                                  AS tenant_name,
          u.email,
          COUNT(d.device_id)                      AS device_count,
          MAX(d.last_seen)                        AS last_active,
          u.created_at                            AS registered_at,
          u.email_verified,
          u.mfa_enabled
        FROM   tenants t
        JOIN   app_users u  ON u.tenant_id = t.id
        LEFT   JOIN devices d ON d.tenant_id = t.id
        GROUP  BY t.id, t.name, u.email, u.created_at, u.email_verified, u.mfa_enabled
        ORDER  BY u.created_at DESC
      `,
      sql`
        SELECT status, COUNT(*) AS count
        FROM   devices
        GROUP  BY status
      `,
      sql`
        SELECT
          'signup'        AS event_type,
          u.email,
          t.name          AS tenant_name,
          u.created_at    AS event_at,
          NULL            AS device_id
        FROM   app_users u
        JOIN   tenants t ON t.id = u.tenant_id
        UNION ALL
        SELECT
          'claim'         AS event_type,
          u.email,
          t.name          AS tenant_name,
          d.claimed_at    AS event_at,
          d.device_id     AS device_id
        FROM   devices d
        JOIN   tenants t ON t.id = d.tenant_id
        JOIN   app_users u ON u.tenant_id = t.id
        WHERE  d.claimed_at IS NOT NULL
        UNION ALL
        SELECT
          'verified'      AS event_type,
          u.email,
          t.name          AS tenant_name,
          u.created_at    AS event_at,
          NULL            AS device_id
        FROM   app_users u
        JOIN   tenants t ON t.id = u.tenant_id
        WHERE  u.email_verified = true
        ORDER  BY event_at DESC NULLS LAST
        LIMIT  50
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM tenants)                                AS total_tenants,
          (SELECT COUNT(*) FROM devices)                                AS total_devices,
          (SELECT COUNT(*) FROM devices WHERE status = 'online')        AS online_devices,
          (SELECT COUNT(*) FROM app_users)                              AS total_users,
          (SELECT COUNT(*) FROM app_users WHERE email_verified = true)  AS verified_users
      `,
    ]);

  return NextResponse.json({
    totals: platformTotals[0],
    tenants,
    deviceSummary,
    recentActivity,
  });
}
