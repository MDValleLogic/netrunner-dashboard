import crypto from "crypto";
import { sql } from "@/lib/db";

/**
 * Create a new device key (returned to the Pi ONCE at registration).
 * Format: vlr_<random>
 */
export function newDeviceKey(): string {
  // 32 bytes => 64 hex chars, strong entropy
  return `vlr_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Store only a hash of the device key in the DB (never store the raw key).
 * Uses SHA-256 hex.
 */
export function hashDeviceKey(deviceKey: string): string {
  return crypto.createHash("sha256").update(deviceKey).digest("hex");
}

/**
 * Validate a raw deviceKey string against DB record (active devices only).
 * Returns the device row or null.
 */
export async function authDevice(deviceKey: string) {
  if (!deviceKey) return null;

  const deviceKeyHash = hashDeviceKey(deviceKey);

  const rows = await sql`
    SELECT device_id, status
    FROM devices
    WHERE device_key_hash = ${deviceKeyHash}
      AND status = 'active'
    LIMIT 1
  `;

  return rows.length ? rows[0] : null;
}

/**
 * Result type for header-based verification.
 */
type VerifyResult =
  | { ok: true; deviceId: string }
  | { ok: false; deviceId: "" };

/**
 * Helper to safely extract first row from Neon results.
 */
function firstRow<T>(rowsOrResult: any): T | null {
  if (Array.isArray(rowsOrResult)) return rowsOrResult[0] ?? null;
  if (rowsOrResult?.rows && Array.isArray(rowsOrResult.rows))
    return rowsOrResult.rows[0] ?? null;
  return null;
}

/**
 * Verifies (deviceId, deviceKey) sent by the probe.
 *
 * Expected headers:
 *  - x-device-id   <device UUID/ID>
 *  - x-device-key  <secret key>
 *
 * Returns ok=false if missing or invalid.
 */
export async function verifyDevice(
  req: Request
): Promise<VerifyResult> {
  const deviceId = req.headers.get("x-device-id") || "";
  const deviceKey = req.headers.get("x-device-key") || "";

  if (!deviceId || !deviceKey) {
    return { ok: false, deviceId: "" };
  }

  // IMPORTANT: no generics here — Neon driver + Vercel can choke on sql<T>
  const result = await sql`
    SELECT device_key_hash
    FROM devices
    WHERE device_id = ${deviceId}
      AND status = 'active'
    LIMIT 1
  `;

  const row = firstRow<{ device_key_hash: string }>(result);
  if (!row) return { ok: false, deviceId: "" };

  const expectedHash = row.device_key_hash;
  const providedHash = hashDeviceKey(deviceKey);

  if (expectedHash !== providedHash) {
    return { ok: false, deviceId: "" };
  }

  return { ok: true, deviceId };
}

