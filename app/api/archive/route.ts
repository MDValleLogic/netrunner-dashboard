import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by Vercel cron (vercel.json) daily at 2am UTC
// Moves measurements older than 24h into measurements_archive
export async function GET(req: Request) {
  // Simple secret check to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Ensure archive table exists
    await sql`
      CREATE TABLE IF NOT EXISTS measurements_archive (
        LIKE measurements INCLUDING ALL
      )
    `;

    // Move rows older than 24h
    const result = await sql`
      WITH moved AS (
        DELETE FROM measurements
        WHERE ts_utc < NOW() - INTERVAL '24 hours'
        RETURNING *
      )
      INSERT INTO measurements_archive
      SELECT * FROM moved
    `;

    const count = (result as any)?.count ?? 0;

    return NextResponse.json({
      ok: true,
      archived: count,
      ran_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
