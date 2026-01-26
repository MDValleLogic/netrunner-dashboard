import { NextResponse } from "next/server";

export const runtime = "nodejs"; // 👈 REQUIRED on Vercel for API routes

export async function POST(request: Request) {
  return NextResponse.json({ ok: true });
}
