import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { newDeviceKey, hashDeviceKey } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function toArray<T = AnyRow>(q: unknown): T[] {
  if (!q) return [];
  if (Array.isArray(q)) return q as T[];
  if (typeof q === "object" && q !== null && "rows" in q) {
    const rows = (q as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

/**
 * Register or upsert a device.
 * Requires an authenticated session.
 * Returns the RAW device key (MVP convenience).
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
    body = {};
  }

  const device_id = String(body.device_id ?? "").trim();
  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id_required" }, { status: 400 });
  }

  const name = String(body.name ?? device_id).trim();

  // If caller provides a device_key, use it; otherwise generate.
  // Store only a hash in DB.
  const rawKey: string = (body.device_key && String(body.device_key).trim()) || newDeviceKey();
  const device_key_hash = hashDeviceKey(rawKey);

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

  const rows = toArray<{ device_id: string }>(q);
  const inserted = rows[0]?.device_id ?? device_id;

  return NextResponse.json({
    ok: true,
    device_id: inserted,
    device_key: rawKey,
  });
}
