import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export async function POST(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const hostname = body.hostname ?? null;
  const ip = body.ip ?? null;
  const mode = body.mode ?? null;
  const tenantId = body.tenant_id ?? null;
  const claimed = body.claimed ?? false;
  const claimCodeSha256 = body.claim_code_sha256 ?? null;

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

  return NextResponse.json({ ok: true });
}

