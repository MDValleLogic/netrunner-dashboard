import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db";
import { newDeviceKey, hashDeviceKey } from "@/lib/authDevice";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body?.name || "NetRunner").toString();

  const device_id = "pi-" + crypto.randomUUID();
  const device_key = newDeviceKey();

  await sql`
    insert into devices (device_id, device_key_hash, name, last_seen)
    values (${device_id}, ${hashDeviceKey(device_key)}, ${name}, now())
  `;

  await sql`
    insert into device_config (device_id, interval_seconds, urls)
    values (${device_id}, 300, ARRAY[]::text[])
  `;

  return NextResponse.json({ device_id, device_key });
}
