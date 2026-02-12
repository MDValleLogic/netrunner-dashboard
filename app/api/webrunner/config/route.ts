import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

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
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deviceId = auth.deviceId;

  // If the DB lookup fails (missing column/table/etc), we fall back to SAFE_DEFAULT.
  try {
    // Expect (optional) json/jsonb column "webrunner_config" on devices.
    // If you don’t have it yet, this query may throw -> caught below.
    const rows = (await sql`
      select
        webrunner_config,
        claimed,
        tenant_id
      from devices
      where device_id = ${deviceId}
      limit 1
    `) as Array<{
      webrunner_config: any;
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

    const cloudConfig = row?.webrunner_config ? normalizeConfig(row.webrunner_config) : SAFE_DEFAULT;
    return NextResponse.json({ ok: true, config: cloudConfig });
  } catch {
    // MVP-safe: never break device operation because DB/schema isn't ready yet
    return NextResponse.json({ ok: true, config: SAFE_DEFAULT });
  }
}

