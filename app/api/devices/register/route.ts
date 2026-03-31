import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { hashDeviceKey } from "@/lib/authDevice";

const VALLELOGIC_TENANT_ID = "b462fa4f-1843-4f18-a6bb-a18388e6f091";

async function createCloudflareTunnel(deviceId: string): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.warn("[REGISTER] Cloudflare env vars not set — skipping tunnel provisioning");
    return null;
  }
  try {
    // Step 1: Create named tunnel
    const createRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          name: `vallelogic-${deviceId}`,
          tunnel_secret: crypto.randomUUID().replace(/-/g, ""),
        }),
      }
    );
    const createData = await createRes.json() as any;
    if (!createData.success) {
      console.error("[REGISTER] Cloudflare tunnel create failed:", JSON.stringify(createData.errors));
      return null;
    }
    const tunnelId = createData.result.id;
    console.log(`[REGISTER] Cloudflare tunnel created: vallelogic-${deviceId} (${tunnelId})`);

    // Step 2: Get tunnel token
    const tokenRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
      {
        headers: { "Authorization": `Bearer ${apiToken}` },
      }
    );
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.success) {
      console.error("[REGISTER] Cloudflare token fetch failed:", JSON.stringify(tokenData.errors));
      return null;
    }
    return tokenData.result as string;

  } catch (e) {
    console.error("[REGISTER] Cloudflare API error:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, nr_serial, device_key, ip, agent_version } = body;

    if (!device_id || !nr_serial || !device_key) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    const device_key_hash = hashDeviceKey(device_key);

    // Check if this is a new device
    const existing = await sql`
      SELECT device_id FROM devices WHERE device_id = ${device_id}
    ` as any[];
    const isNew = existing.length === 0;

    await sql`
      INSERT INTO devices (device_id, nr_serial, cpu_serial_hash, device_key_hash, status, last_ip, agent_version)
      VALUES (
        ${device_id}, ${nr_serial}, ${device_id},
        ${device_key_hash}, 'provisioned', ${ip || null}, ${agent_version || null}
      )
      ON CONFLICT (device_id) DO UPDATE SET
        device_key_hash = EXCLUDED.device_key_hash,
        last_ip         = EXCLUDED.last_ip,
        agent_version   = EXCLUDED.agent_version,
        last_seen       = NOW(),
        updated_at      = NOW()
    `;

    // Auto-provision Cloudflare tunnel for new devices only
    if (isNew) {
      const tunnelToken = await createCloudflareTunnel(device_id);
      if (tunnelToken) {
        const content = `TUNNEL_TOKEN=${tunnelToken}\n`;
        await sql`
          INSERT INTO pending_commands (device_id, tenant_id, command_type, payload)
          VALUES (
            ${device_id},
            ${VALLELOGIC_TENANT_ID},
            'update_file',
            ${JSON.stringify({ path: "/etc/vallelogic/tunnel.env", content })}
          )
        `;
        console.log(`[REGISTER] Queued tunnel.env provisioning for ${device_id}`);
      }
    }

    return NextResponse.json({ ok: true, nr_serial, device_id, status: "registered" });

  } catch (e: any) {
    console.error("[REGISTER]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
