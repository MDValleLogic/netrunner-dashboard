import { sql } from "@/lib/db";

export interface MCPAuthResult {
  tenantId: string;
  keyId: string;
}

export async function validateMCPKey(
  authHeader: string | null
): Promise<MCPAuthResult | null> {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(vlmcp_[a-zA-Z0-9_]+)$/);
  if (!match) return null;

  const rawKey = match[1];

  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const rows = await sql`
    SELECT id, tenant_id
    FROM mcp_api_keys
    WHERE key_hash = ${keyHash}
      AND revoked_at IS NULL
    LIMIT 1
  ` as any[];

  if (rows.length === 0) return null;

  const row = rows[0];

  sql`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = ${row.id}`.catch(() => {});

  return { tenantId: row.tenant_id, keyId: row.id };
}

export async function generateMCPKey(
  tenantId: string,
  label: string
): Promise<{ rawKey: string; keyId: string }> {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const secret = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `vlmcp_${secret}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const rows = await sql`
    INSERT INTO mcp_api_keys (tenant_id, label, key_hash, created_at)
    VALUES (${tenantId}, ${label}, ${keyHash}, NOW())
    RETURNING id
  ` as any[];

  return { rawKey, keyId: rows[0].id };
}

export async function revokeMCPKey(
  keyId: string,
  tenantId: string
): Promise<boolean> {
  const rows = await sql`
    UPDATE mcp_api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId} AND tenant_id = ${tenantId}
    RETURNING id
  ` as any[];
  return rows.length > 0;
}

export async function listMCPKeys(tenantId: string) {
  const rows = await sql`
    SELECT id, label, created_at, last_used_at
    FROM mcp_api_keys
    WHERE tenant_id = ${tenantId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  ` as any[];
  return rows;
}
