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
  const urls = Array.isArray(input?.urls) ? input.urls.filter((u: any) => typeof u === "string" && u.startsWith("http")) : [];
  const interval = Number.isFinite(Number(input?.interval_seconds)) ? Number(input.interval_seconds) : SAFE_DEFAULT.interval_seconds;
  const timeout = Number.isFinite(Number(input?.timeout_seconds)) ? Number(input.timeout_seconds) : SAFE_DEFAULT.timeout_seconds;
  const mode = typeof input?.mode === "string" ? input.mode : SAFE_DEFAULT.mode;

  return {
    mode,
    urls: urls.length ? urls : SAFE_DEFAULT.urls,
    interval_seconds: interval,
    timeout_seconds: timeout,
  };
}

export async function GET(req: Request) {
  // Allow session auth for dashboard calls
  const session = await getServerSession(authOptions);
  const auth = session ? { ok: true, deviceId: new URL(req.url).searchParams.get("device_id") || "" } : await verifyDevice(req);

  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deviceId = auth.deviceId;
  console.log("[config GET] deviceId=", deviceId, "session=", !!session);

  // If the DB lookup fails (missing column/table/etc), we fall back to SAFE_DEFAULT.
  try {
    // Expect (optional) json/jsonb column "webrunner_config" on devices.
    // If you don’t have it yet, this query may throw -> caught below.
    const rows = (await sql`
      select
        config_json,
        claimed,
        tenant_id
      from devices
      where device_id = ${deviceId}
      limit 1
    `) as Array<{
      config_json: any;
      claimed: boolean | null;
      tenant_id: string | null;
    }>;

    const row = rows?.[0] ?? null;

    // Unclaimed devices ALWAYS get safe default
    const claimed = Boolean(row?.claimed);
    const tenantId = (row?.tenant_id ?? "").trim();
    if (!claimed || !tenantId) {
      return NextResponse.json({ ok: true, config: SAFE_DEFAULT });
    }

    const cloudConfig = row?.config_json ? normalizeConfig(row.config_json) : SAFE_DEFAULT;
    console.log("[config GET] returning:", JSON.stringify(cloudConfig));
    console.log("[config GET] returning:", JSON.stringify(cloudConfig));
    return NextResponse.json({ ok: true, config: cloudConfig });
  } catch {
    // MVP-safe: never break device operation because DB/schema isn't ready yet
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
  if (!device_id) return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

  const cleanUrls = Array.isArray(urls) ? urls.filter((u: any) => typeof u === "string" && u.startsWith("http")) : [];
  const interval = Number.isFinite(Number(interval_seconds)) ? Number(interval_seconds) : 300;

  const config = { urls: cleanUrls, interval_seconds: interval, mode: "cloud" };

  await sql`
    UPDATE devices
    SET config_json = ${JSON.stringify(config)},
        updated_at = NOW()
    WHERE device_id = ${device_id}
  `;

  return NextResponse.json({ ok: true, config: { ...config, updated_at: new Date().toISOString() } });
}
