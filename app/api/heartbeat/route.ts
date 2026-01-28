import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export async function POST(req: Request) {
  const device = await verifyDevice(req);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  await sql`
    update devices
    set last_seen = now()
    where device_id = ${device.device_id}
  `;

  return NextResponse.json({ ok: true });
}
