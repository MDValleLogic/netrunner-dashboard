import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { device_id, name } = body;

    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: "device_id required" },
        { status: 400 }
      );
    }

    // Generate device key
    const device_key = "vl_" + crypto.randomBytes(24).toString("hex");
    const device_key_hash = crypto
      .createHash("sha256")
      .update(device_key)
      .digest("hex");

    // Insert or update device
    await sql`
      insert into devices (device_id, name, device_key_hash)
      values (${device_id}, ${name || device_id}, ${device_key_hash})
      on conflict (device_id)
      do update set
        name = excluded.name,
        device_key_hash = excluded.device_key_hash,
        updated_at = now()
    `;

    return NextResponse.json({
      ok: true,
      device_id,
      device_key, // RETURNED ONCE
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "register failed" },
      { status: 500 }
    );
  }
}

