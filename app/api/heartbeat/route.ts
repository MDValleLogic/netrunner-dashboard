import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeartbeatBody = {
  hostname?: string;
  ip?: string;
  claimed?: boolean;
  tenant_id?: string | null; // ignored
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

  // Device can report claimed=true, but never allow claimed=false to override DB.
  const claimedFromDevice = asBool(body.claimed);

  const claimCodeSha256 = asString(body.claim_code_sha256).trim() || null;

  try {
    const r = await sql`
      update devices
      set
        last_seen = now(),
        hostname = coalesce(${hostname}, hostname),
        ip       = coalesce(${ip}, ip),
        mode     = coalesce(${mode}, mode),
        claimed  = (claimed OR ${claimedFromDevice}),
        claim_code_sha256 = coalesce(${claimCodeSha256}, claim_code_sha256),
        updated_at = now()
      where device_id = ${deviceId}
      returning device_id
    `;

    const updated =
      Array.isArray(r) ? r[0]?.device_id :
      (r as any)?.rows?.[0]?.device_id ?? null;

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "device_not_registered", device_id: deviceId },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, device_id: deviceId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
