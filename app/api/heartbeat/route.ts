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
  // Always return JSON (never "500 empty") + log real cause to Vercel
  try {
    let auth;
    try {
      auth = await verifyDevice(req);
    } catch (e: any) {
      console.error("[heartbeat] verifyDevice threw:", e?.message || e);
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!auth?.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Parse body safely (don’t trust clients)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const device_id = auth.deviceId;
    const hostname = typeof body.hostname === "string" ? body.hostname : null;
    const ip = typeof body.ip === "string" ? body.ip : null;
    const mode = typeof body.mode === "string" ? body.mode : null;
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id : null;
    const claimed = typeof body.claimed === "boolean" ? body.claimed : null;
    const claim_code_sha256 =
      typeof body.claim_code_sha256 === "string" ? body.claim_code_sha256 : null;

    // Compute device_key_hash from header key so we always satisfy NOT NULL if required
    const key = req.headers.get("x-device-key") || "";
    const device_key_hash = key ? sha256Hex(key) : null;

    // Upsert
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
        ${device_id},
        ${device_key_hash},
        now(),
        ${hostname},
        ${ip},
        ${mode},
        ${tenant_id},
        ${claimed},
        ${claim_code_sha256}
      )
      on conflict (device_id) do update
      set
        last_seen = now(),
        device_key_hash = coalesce(excluded.device_key_hash, devices.device_key_hash),
        hostname = coalesce(excluded.hostname, devices.hostname),
        ip = coalesce(excluded.ip, devices.ip),
        mode = coalesce(excluded.mode, devices.mode),
        tenant_id = coalesce(excluded.tenant_id, devices.tenant_id),
        claimed = coalesce(excluded.claimed, devices.claimed),
        claim_code_sha256 = coalesce(excluded.claim_code_sha256, devices.claim_code_sha256)
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[heartbeat] server_error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

