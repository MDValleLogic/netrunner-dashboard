import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS = { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  return NextResponse.json({ ok: true, device_id, config: DEFAULTS, source: "default" });
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, targets, interval_seconds } = await req.json();
    if (!device_id || !targets) return NextResponse.json({ ok: false, error: "device_id and targets required" }, { status: 400 });
    return NextResponse.json({ ok: true, device_id, targets, interval_seconds: interval_seconds || 300 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
