import { db } from "@/lib/db";

export interface MCPAuthResult {
  tenantId: string;
  keyId: string;
}

/**
 * Validates an MCP API key from the Authorization header.
 * Keys are formatted as: vlmcp_<keyId>_<secret>
 * Stored hashed in mcp_api_keys table, scoped per tenant.
 */
export async function validateMCPKey(
  authHeader: string | null
): Promise<MCPAuthResult | null> {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(vlmcp_[a-zA-Z0-9_]+)$/);
  if (!match) return null;

  const rawKey = match[1];

  // Hash the incoming key for comparison
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await db.query(
    `SELECT id, tenant_id
     FROM mcp_api_keys
     WHERE key_hash = $1
       AND revoked_at IS NULL
     LIMIT 1`,
    [keyHash]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Update last_used_at asynchronously — don't await
  db.query(`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`, [
    row.id,
  ]).catch(() => {});

  return { tenantId: row.tenant_id, keyId: row.id };
}

/**
 * Generates a new MCP API key for a tenant.
 * Returns the raw key (shown once) and stores the hash.
 */
export async function generateMCPKey(
  tenantId: string,
  label: string
): Promise<{ rawKey: string; keyId: string }> {
  // Generate: vlmcp_<16 random bytes hex>
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const secret = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `vlmcp_${secret}`;

  // Hash for storage
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await db.query(
    `INSERT INTO mcp_api_keys (tenant_id, label, key_hash, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [tenantId, label, keyHash]
  );

  return { rawKey, keyId: result.rows[0].id };
}

/**
 * Revokes an MCP API key.
 */
export async function revokeMCPKey(
  keyId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE mcp_api_keys
     SET revoked_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [keyId, tenantId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Lists all active MCP API keys for a tenant (never returns key material).
 */
export async function listMCPKeys(tenantId: string) {
  const result = await db.query(
    `SELECT id, label, created_at, last_used_at
     FROM mcp_api_keys
     WHERE tenant_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}
