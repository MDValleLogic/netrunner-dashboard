import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";

// GET /api/devices — list all devices
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        device_id, nr_serial, status, nickname, site_name,
        address, lat, lng, agent_version, last_seen, last_ip,
        image_version, provisioned_at, claimed_at, tenant_id
      FROM devices
      ORDER BY provisioned_at DESC
    `;
    return NextResponse.json({ ok: true, devices: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// PATCH /api/devices — update nickname, address, site_name + geocode
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, nickname, address, site_name } = body;

    if (!device_id) {
      return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
    }

    // Geocode address if provided
    let lat: number | null = null;
    let lng: number | null = null;

    if (address && address.trim()) {
      try {
        const encoded = encodeURIComponent(address.trim());
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
          { signal: AbortSignal.timeout(5000) }
        );
        const geoJson = await geoRes.json();
        if (geoJson.status === "OK" && geoJson.results?.[0]) {
          lat = geoJson.results[0].geometry.location.lat;
          lng = geoJson.results[0].geometry.location.lng;
        }
      } catch (e) {
        console.error("[geocode] failed:", e);
      }
    }

    await sql`
      UPDATE devices SET
        nickname   = COALESCE(${nickname ?? null}, nickname),
        address    = COALESCE(${address ?? null}, address),
        site_name  = COALESCE(${site_name ?? null}, site_name),
        lat        = CASE WHEN ${lat} IS NOT NULL THEN ${lat} ELSE lat END,
        lng        = CASE WHEN ${lng} IS NOT NULL THEN ${lng} ELSE lng END,
        updated_at = now()
      WHERE device_id = ${device_id}
    `;

    return NextResponse.json({ ok: true, lat, lng });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
