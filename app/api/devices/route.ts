import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
export const dynamic = "force-dynamic";

// GET /api/devices — list devices for this tenant only
export async function GET() {
  try {
    const { tenantId } = await requireTenantSession();
    const rows = await sql`
      SELECT
        device_id, nr_serial, status, nickname, site_name, location,
        address, lat, lng, agent_version, last_seen, last_ip,
        image_version, provisioned_at, claimed_at, tenant_id
      FROM devices
      WHERE tenant_id = ${tenantId}
      ORDER BY provisioned_at DESC
    `;
    return NextResponse.json({ ok: true, devices: rows });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// PATCH /api/devices — update nickname, address, site_name + geocode (tenant-scoped)
export async function PATCH(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantSession();
    const body = await req.json();
    const { device_id, nickname, address, site_name, location } = body;

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
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`,
          { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined }
        );
        const geoJson = await geoRes.json();
        console.log("[geocode] status:", geoJson.status, "key present:", !!process.env.GOOGLE_GEOCODING_API_KEY);
        if (geoJson.status === "OK" && geoJson.results?.[0]) {
          lat = geoJson.results[0].geometry.location.lat;
          lng = geoJson.results[0].geometry.location.lng;
          console.log("[geocode] got:", lat, lng);
        }
      } catch (e) {
        console.error("[geocode] failed:", e);
      }
    }

    // All updates scoped to tenant_id — cannot touch another tenant's device
    if (nickname !== undefined) {
      await sql`UPDATE devices SET nickname = ${nickname}, updated_at = now() WHERE device_id = ${device_id} AND tenant_id = ${tenantId}`;
    }
    if (address !== undefined) {
      await sql`UPDATE devices SET address = ${address}, updated_at = now() WHERE device_id = ${device_id} AND tenant_id = ${tenantId}`;
    }
    if (site_name !== undefined) {
      await sql`UPDATE devices SET site_name = ${site_name}, updated_at = now() WHERE device_id = ${device_id} AND tenant_id = ${tenantId}`;
    }
    if (location !== undefined) {
      await sql`UPDATE devices SET location = ${location}, updated_at = now() WHERE device_id = ${device_id} AND tenant_id = ${tenantId}`;
    }
    if (lat !== null && lng !== null) {
      await sql`UPDATE devices SET lat = ${lat}, lng = ${lng}, updated_at = now() WHERE device_id = ${device_id} AND tenant_id = ${tenantId}`;
    }

    return NextResponse.json({ ok: true, lat, lng });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
