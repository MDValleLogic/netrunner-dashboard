import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdminSession } from "@/lib/requireAdminSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;

  const sql = neon(process.env.DATABASE_URL!);

  const devices = await sql`
    SELECT
      d.device_id,
      d.nickname            AS device_name,
      d.nr_serial,
      d.status,
      d.last_ip             AS ip_address,
      d.last_seen,
      d.agent_version,
      d.claimed_at,
      d.created_at,
      t.id                  AS tenant_id,
      t.name                AS tenant_name,
      u.email               AS owner_email,
      CASE
        WHEN d.last_seen > NOW() - INTERVAL '5 minutes' THEN 'online'
        WHEN d.last_seen > NOW() - INTERVAL '1 hour'    THEN 'idle'
        WHEN d.last_seen IS NOT NULL                    THEN 'offline'
        ELSE 'never_seen'
      END                   AS computed_status,
      EXTRACT(EPOCH FROM (NOW() - d.last_seen)) AS seconds_since_heartbeat
    FROM   devices d
    LEFT JOIN tenants   t ON t.id = d.tenant_id
    LEFT JOIN app_users u ON u.tenant_id = t.id
    ORDER  BY d.last_seen DESC NULLS LAST
  `;

  return NextResponse.json({ devices });
}
