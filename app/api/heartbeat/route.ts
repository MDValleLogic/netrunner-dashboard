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
  tenant_id?: string | null; // ignored for security; server is source of truth
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
    body = {};
  }

  const deviceId = auth.deviceId;

  const hostname = asString(body.hostname).trim() || null;
  const ip = asString(body.ip).trim() || null;
  const mode = asString(body.mode).trim() || null;

  // Device may say claimed=true, but we will NEVER allow claimed=false to override DB.
  const claimedFromDevice = asBool(body.claimed);

  const claimCodeSha256 = asString(body.claim_code_sha256).trim() || null;

  try {
    await sql`
      insert into devices (
        device_id,
        last_seen,
        hostname,
        ip,
        mode,
        claimed,
        claim_code_sha256
      )
      values (
        ${deviceId},
        now(),
        ${hostname},
        ${ip},
        ${mode},
        ${claimedFromDevice},
        ${claimCodeSha256}
      )
      on conflict (device_id) do update
      set
        last_seen = now(),
        hostname = coalesce(excluded.hostname, devices.hostname),
        ip       = coalesce(excluded.ip, devices.ip),
        mode     = coalesce(excluded.mode, devices.mode),

        -- Monotonic claim: once claimed in DB, never let heartbeat set it false.
        claimed   = (devices.claimed OR excluded.claimed),

        claim_code_sha256 = coalesce(excluded.claim_code_sha256, devices.claim_code_sha256)
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
