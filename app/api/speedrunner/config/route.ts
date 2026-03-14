import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const DEFAULTS = { interval_seconds: 3600, regions: ["Northeast US","Southeast US","Midwest US","West Coast US","Europe","Asia Pacific"] };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  return NextResponse.json({ ok: true, device_id, config: DEFAULTS, source: "default" });
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, interval_seconds, regions } = await req.json();
    if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
    return NextResponse.json({ ok: true, device_id, interval_seconds: interval_seconds||3600, regions: regions||[] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
