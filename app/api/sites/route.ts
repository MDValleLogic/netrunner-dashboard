import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";

// ── GET — List all sites for tenant ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;

  const sites = await sql`
    SELECT
      s.id,
      s.name,
      s.address,
      s.district,
      s.city,
      s.state,
      s.lat,
      s.lng,
      s.created_at,
      s.updated_at,
      COUNT(d.device_id)::int AS device_count,
      COUNT(CASE WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 1 END)::int AS devices_online
    FROM sites s
    LEFT JOIN devices d ON d.site_name = s.name AND d.tenant_id = ${tenantId}::uuid
    WHERE s.tenant_id = ${tenantId}::uuid
    GROUP BY s.id
    ORDER BY s.name
  ` as any[];

  return NextResponse.json({ ok: true, sites });
}

// ── POST — Create a new site ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, address, district, city, state, lat, lng } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO sites (tenant_id, name, address, district, city, state, lat, lng)
    VALUES (
      ${tenantId}::uuid,
      ${name.trim()},
      ${address ?? null},
      ${district ?? null},
      ${city ?? null},
      ${state ?? null},
      ${lat ?? null},
      ${lng ?? null}
    )
    RETURNING *
  ` as any[];

  return NextResponse.json({ ok: true, site: rows[0] }, { status: 201 });
}
