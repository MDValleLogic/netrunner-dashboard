import crypto from "crypto";
import { sql } from "./db";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Generates a new device key to hand to a device one time.
// Store ONLY the hash server-side.
export function newDeviceKey() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashDeviceKey(key: string) {
  return sha256(key);
}

type VerifyResult =
  | { ok: true; deviceId: string }
  | { ok: false; deviceId: "" };

function firstRow<T>(rowsOrResult: any): T | null {
  if (Array.isArray(rowsOrResult)) return (rowsOrResult[0] as T) ?? null;
  if (rowsOrResult && Array.isArray(rowsOrResult.rows))
    return (rowsOrResult.rows[0] as T) ?? null;
  return null;
}

// Verifies (deviceId, deviceKey) sent by the probe.
// Expected headers:
//   x-device-id: <device UUID/ID>
//   x-device-key: <secret key>
// Returns ok=false if missing/invalid.
export async function verifyDevice(req: Request): Promise<VerifyResult> {
  const deviceId = req.headers.get("x-device-id") || "";
  const deviceKey = req.headers.get("x-device-key") || "";

  if (!deviceId || !deviceKey) return { ok: false, deviceId: "" };

  // IMPORTANT: no generics here (Neon driver used in Vercel was choking on sql<T>)
  const result = await sql(
    "select device_key_hash from devices where device_id = $1 limit 1",
    [deviceId]
  );

  const row = firstRow<{ device_key_hash: string }>(result);
  if (!row?.device_key_hash) return { ok: false, deviceId: "" };

  const ok = row.device_key_hash === sha256(deviceKey);
  if (!ok) return { ok: false, deviceId: "" };

  return { ok: true, deviceId };
}
