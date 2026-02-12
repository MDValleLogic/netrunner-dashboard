import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export async function POST(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));

  const deviceId = auth.deviceId;

  // We need a non-null device_key_hash for first-time insert.
  // Prefer value returned by verifyDevice (if available), otherwise hash header key directly.
  const rawKey =
    (auth as any).deviceKey ||
    req.headers.get("x-device-key") ||
    "";

  const deviceKeyHash = rawKey ? sha256Hex(rawKey) : "";

  if (!deviceKeyHash) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: "missing device key for hashing" },
      { status: 500 }
    );
  }

  const hostname = typeof body?.hostname === "string" ? body.hostname : null;
  const ip = typeof body?.ip === "string" ? body.ip : null;
  const mode = typeof body?.mode === "string" ? body.mode : null;
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : null;
  const claimed = typeof body?.claimed === "boolean" ? body.claimed : null;
  const claimCodeSha256 = typeof body?.claim_code_sha256 === "string" ? body.claim_code_sha256 : null;

  await sql`
    insert into devices (
      device_id,
      device_key_hash,
      last_seen,
      hostname,
      ip,
      mode,
      tenant_id,
      claimed,
      claim_code_sha256
    )
    values (
      ${deviceId},
      ${deviceKeyHash},
      now(),
      ${hostname},
      ${ip},
      ${mode},
      ${tenantId},
      ${claimed},
      ${claimCodeSha256}
    )
    on conflict (device_id) do update
    set
      last_seen = now(),
      hostname = coalesce(excluded.hostname, devices.hostname),
      ip       = coalesce(excluded.ip, devices.ip),
      mode     = coalesce(excluded.mode, devices.mode),
      tenant_id = coalesce(excluded.tenant_id, devices.tenant_id),
      claimed   = coalesce(excluded.claimed, devices.claimed),
      claim_code_sha256 = coalesce(excluded.claim_code_sha256, devices.claim_code_sha256)
  `;

  return NextResponse.json({ ok: true });
}

