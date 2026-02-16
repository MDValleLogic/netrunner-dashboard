import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeartbeatBody = {
  device_id?: string;
  ts_utc?: string;
  hostname?: string;
  ip?: string;
  claimed?: boolean;
  tenant_id?: string | null; // UUID in DB, but clients may send "" / null
  mode?: string;
  claim_code_sha256?: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

export async function POST(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: HeartbeatBody = {};
  try {
    body = (await req.json()) as HeartbeatBody;
  } catch {
    // allow empty/invalid json; we still want to upsert last_seen
    body = {};
  }

  const deviceId = auth.deviceId;

  const hostname = asString(body.hostname).trim() || null;
  const ip = asString(body.ip).trim() || null;
  const mode = asString(body.mode).trim() || null;

  const claimed = asBool(body.claimed);

  // IMPORTANT: tenant_id is UUID in DB. Empty string must become NULL.
  const tenantIdRaw = asString(body.tenant_id).trim();
  const tenantId = tenantIdRaw.length > 0 ? tenantIdRaw : null;

  const claimCodeSha256 = asString(body.claim_code_sha256).trim() || null;

  // We want device_key_hash to be present (NOT NULL) for inserts.
  // If your schema requires it, compute from the presented key header.
  const presentedKey = req.headers.get("x-device-key") || "";
  const deviceKeyHash = presentedKey ? presentedKey : null; // (If you hash elsewhere, swap this.)

  try {
    await sql`
      insert into devices (
        device_id,
        last_seen,
        hostname,
        ip,
        mode,
        tenant_id,
        claimed,
        claim_code_sha256,
        device_key_hash
      )
      values (
        ${deviceId},
        now(),
        ${hostname},
        ${ip},
        ${mode},
        nullif(${tenantId}, '')::uuid,
        ${claimed},
        ${claimCodeSha256},
        ${deviceKeyHash}
      )
      on conflict (device_id) do update
      set
        last_seen = now(),
        hostname = coalesce(excluded.hostname, devices.hostname),
        ip       = coalesce(excluded.ip, devices.ip),
        mode     = coalesce(excluded.mode, devices.mode),
        tenant_id = coalesce(excluded.tenant_id, devices.tenant_id),
        claimed   = coalesce(excluded.claimed, devices.claimed),
        claim_code_sha256 = coalesce(excluded.claim_code_sha256, devices.claim_code_sha256),
        device_key_hash = coalesce(excluded.device_key_hash, devices.device_key_hash)
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // return the real DB error to speed debugging
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

