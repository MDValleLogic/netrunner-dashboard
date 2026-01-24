import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export async function POST(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await sql`
    update devices
    set last_seen = now()
    where device_id = ${auth.deviceId}
  `;

  return NextResponse.json({ ok: true });
}
