import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL(req.url);

  // Forward /v1/device/heartbeat -> /api/heartbeat
  const target = new URL(url.toString());
  target.pathname = "/api/heartbeat";

  const body = await req.text();

  const res = await fetch(target.toString(), {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") || "application/json" },
    body,
    cache: "no-store",
  });

  const out = await res.text();

  return new NextResponse(out, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

