import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // temp: just prove we can receive structured data
    return NextResponse.json({ ok: true, received: body });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "invalid_json", detail: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}
