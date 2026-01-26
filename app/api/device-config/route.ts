export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid JSON body" },
        { status: 400 }
      );
    }

    const device_id = (body.device_id || "").trim();
    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: "device_id is required" },
        { status: 400 }
      );
    }

    const urls = Array.isArray(body.urls)
      ? body.urls.map((u: any) => String(u).trim()).filter(Boolean)
      : [];

    const interval_seconds =
      Number.isFinite(body.interval_seconds) && body.interval_seconds > 0
        ? Math.floor(body.interval_seconds)
        : 300;

    await sql`
      INSERT INTO device_config (device_id, urls, interval_seconds, updated_at)
      VALUES (
        ${device_id},
        ${JSON.stringify(urls)}::jsonb,
        ${interval_seconds},
        NOW()
      )
      ON CONFLICT (device_id)
      DO UPDATE SET
        urls = EXCLUDED.urls,
        interval_seconds = EXCLUDED.interval_seconds,
        updated_at = NOW();
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // This is the important part: return the real error so we can fix it fast
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
