import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Forward /v1/device/config -> /api/device-config
  const target = new URL(url.toString());
  target.pathname = "/api/device-config";

  const res = await fetch(target.toString(), {
    cache: "no-store",
  });

  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

