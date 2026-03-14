import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULTS = {
  urls: ["https://www.google.com/generate_204"],
  interval_seconds: 300,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const device_id = (searchParams.get("device_id") || "").trim();
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id_required" }, { status: 400 });
  return NextResponse.json({ ok: true, device_id, config: DEFAULTS, source: "default", fetched_at_utc: new Date().toISOString() });
}
