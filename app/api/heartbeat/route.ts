import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeartbeatBody = {
  ip?: string;
  agent_version?: string;
};

type AnyRow = Record<string, any>;
function toArray<T = AnyRow>(q: unknown): T[] {
  if (!q) return [];
  if (Array.isArray(q)) return q as T[];
  if (typeof q === "object" && q !== null && "rows" in q) {
    const rows = (q as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
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
  const ip = asString(body.ip).trim() || null;
  const agent_version = asString(body.agent_version).trim() || null;

  try {
    const r = await sql`
      UPDATE devices SET
        last_seen     = NOW(),
        last_ip       = COALESCE(${ip}, last_ip),
        agent_version = COALESCE(${agent_version}, agent_version),
        updated_at    = NOW()
      WHERE device_id = ${deviceId}
      RETURNING device_id
    `;

    const rows = toArray<{ device_id: string }>(r);
    const updated = rows[0]?.device_id ?? null;

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
