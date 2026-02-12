import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(v: any): string | null {
  return typeof v === "string" && v.trim().length ? v.trim() : null;
}

function asBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const auth = await verifyDevice(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Body is optional; we accept empty JSON too
    const body: any = await req.json().catch(() => ({}));

    const hostname = asString(body.hostname);
    const ip = asString(body.ip);
    const mode = asString(body.mode);
    const tenantId = asString(body.tenant_id ?? body.tenantId);
    const claimed = asBool(body.claimed);
    const claimCodeSha256 = asString(body.claim_code_sha256 ?? body.claimCodeSha256);

    // Upsert device row, but don't overwrite existing values with nulls.
    await sql`
      insert into devices (
        device_id,
        last_seen,
        hostname,
        ip,
        mode,
        tenant_id,
        claimed,
        claim_code_sha256
      )
      values (
        ${auth.deviceId},
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
        ip = coalesce(excluded.ip, devices.ip),
        mode = coalesce(excluded.mode, devices.mode),
        tenant_id = coalesce(excluded.tenant_id, devices.tenant_id),
        claimed = coalesce(excluded.claimed, devices.claimed),
        claim_code_sha256 = coalesce(excluded.claim_code_sha256, devices.claim_code_sha256)
    `;

    return NextResponse.json({ ok: true, device_id: auth.deviceId });
  } catch (e: any) {
    // IMPORTANT: return the actual error so we can debug remotely from the Pi.
    console.error("[heartbeat] ERROR:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: e?.message ? String(e.message) : String(e),
      },
      { status: 500 }
    );
  }
}
