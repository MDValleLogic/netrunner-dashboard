import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

type WebRunnerConfig = {
  mode?: string;
  urls: string[];
  interval_seconds?: number;
  timeout_seconds?: number;
};

const SAFE_DEFAULT: WebRunnerConfig = {
  mode: "safe-default",
  urls: ["https://www.google.com/generate_204"],
  interval_seconds: 300,
  timeout_seconds: 10,
};

function normalizeConfig(input: any): WebRunnerConfig {
  if (typeof input === "string") { try { input = JSON.parse(input); } catch {} }
  const urls = Array.isArray(input?.urls)
    ? input.urls.filter((u: any) => typeof u === "string" && u.startsWith("http"))
    : [];
  const interval = Number.isFinite(Number(input?.interval_seconds))
    ? Number(input.interval_seconds)
    : SAFE_DEFAULT.interval_seconds;
  const timeout = Number.isFinite(Number(input?.timeout_seconds))
    ? Number(input.timeout_seconds)
    : SAFE_DEFAULT.timeout_seconds;
  const mode = typeof input?.mode === "string" ? input.mode : "cloud";

  return {
    mode,
    urls: urls.length ? urls : SAFE_DEFAULT.urls,
    interval_seconds: interval,
    timeout_seconds: timeout,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const auth = session
    ? { ok: true, deviceId: new URL(req.url).searchParams.get("device_id") || "" }
    : await verifyDevice(req);

  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deviceId = auth.deviceId;
  console.log("[config GET] deviceId=", deviceId, "session=", !!session);

  try {
    const rows = (await sql`
      SELECT config_json
      FROM devices
      WHERE device_id = ${deviceId}
      LIMIT 1
    `) as Array<{ config_json: any }>;

    const row = rows?.[0] ?? null;
    console.log("[config GET] row=", JSON.stringify(row));

    // Use config_json if present, otherwise SAFE_DEFAULT
    const cloudConfig = row?.config_json
      ? normalizeConfig(row.config_json)
      : SAFE_DEFAULT;

    console.log("[config GET] returning:", JSON.stringify(cloudConfig));
    return NextResponse.json({ ok: true, config: cloudConfig });
  } catch (err) {
    console.error("[config GET] DB error:", err);
    return NextResponse.json({ ok: true, config: SAFE_DEFAULT });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { device_id, urls, interval_seconds } = body || {};
  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  }

  const cleanUrls = Array.isArray(urls)
    ? urls.filter((u: any) => typeof u === "string" && u.startsWith("http"))
    : [];
  const interval = Number.isFinite(Number(interval_seconds)) ? Number(interval_seconds) : 300;

  const config = { urls: cleanUrls, interval_seconds: interval, mode: "cloud" };

  await sql`
    UPDATE devices
    SET config_json = ${JSON.stringify(config)},
        updated_at  = NOW()
    WHERE device_id = ${device_id}
  `;

  return NextResponse.json({
    ok: true,
    config: { ...config, updated_at: new Date().toISOString() },
  });
}
