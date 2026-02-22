import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { newDeviceKey, hashDeviceKey } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Register or upsert a device.
 * Requires an authenticated session (admin/user in app).
 * Returns the RAW device key only when a new key is generated.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body; we'll still register with defaults if needed
  }

  const device_id = String(body.device_id ?? "").trim();
  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id_required" }, { status: 400 });
  }

  const name = String(body.name ?? device_id).trim();

  // If caller provides a device_key, use it ONCE, otherwise generate a new one.
  // Important: we store only the hash.
  const rawKey: string = (body.device_key && String(body.device_key).trim()) || newDeviceKey();
  const device_key_hash = hashDeviceKey(rawKey);

  // NOTE: tenant_id is intentionally NOT set here for MVP unless you want it.
  // Claim flow should bind tenant_id.
  const q = await sql`
    insert into devices (device_id, name, device_key_hash, status, created_at, updated_at)
    values (${device_id}, ${name}, ${device_key_hash}, 'active', now(), now())
    on conflict (device_id) do update set
      name = excluded.name,
      device_key_hash = excluded.device_key_hash,
      status = 'active',
      updated_at = now()
    returning device_id
  `;

  const inserted =
    Array.isArray(q) ? q[0]?.device_id :
    (q as any)?.rows?.[0]?.device_id ?? device_id;

  // For security: only return the raw key when explicitly requested or when you generate it.
  // MVP: return it always for now so you can provision the Pi easily.
  return NextResponse.json({
    ok: true,
    device_id: inserted,
    device_key: rawKey,
  });
}
