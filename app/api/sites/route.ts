import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";

// ── Geocode helper ───────────────────────────────────────────────────────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address.trim());
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined }
    );
    const geoJson = await geoRes.json();
    console.log("[geocode] status:", geoJson.status, "key present:", !!process.env.GOOGLE_GEOCODING_API_KEY);
    if (geoJson.status === "OK" && geoJson.results?.[0]) {
      const { lat, lng } = geoJson.results[0].geometry.location;
      console.log("[geocode] got:", lat, lng);
      return { lat, lng };
    }
  } catch (e) {
    console.error("[geocode] failed:", e);
  }
  return null;
}

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

  const { name, address, district, city, state } = body;
  let { lat, lng } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Geocode address if lat/lng not explicitly provided
  if (address?.trim() && (lat == null || lng == null)) {
    const coords = await geocodeAddress(address.trim());
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
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
