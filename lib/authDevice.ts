import crypto from "crypto";
import { sql } from "./db";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function newDeviceKey() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashDeviceKey(key: string) {
  return sha256(key);
}

export async function verifyDevice(req: Request) {
  const deviceId = req.headers.get("x-device-id") || "";
  const deviceKey = req.headers.get("x-device-key") || "";
  if (!deviceId || !deviceKey) return { ok: false as const, deviceId: "" };

  const rows = await sql<{ device_key_hash: string }>(
    "select device_key_hash from devices where device_id = $1 limit 1",
    [deviceId]
  );

  if (!rows.length) return { ok: false as const, deviceId: "" };

  return {
    ok: rows[0].device_key_hash === sha256(deviceKey),
    deviceId,
  };
}
