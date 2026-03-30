import { createHash, randomBytes } from "crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

async function generateMCPKey(tenantId, label) {
  const secret = randomBytes(16).toString("hex");
  const rawKey = `vlmcp_${secret}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const rows = await sql`
    INSERT INTO mcp_api_keys (tenant_id, label, key_hash, created_at)
    VALUES (${tenantId}, ${label}, ${keyHash}, NOW())
    RETURNING id
  `;

  console.log(`\n✅ ${label}`);
  console.log(`   Token: ${rawKey}`);
  console.log(`   Key ID: ${rows[0].id}`);
  return rawKey;
}

await generateMCPKey("bf458387-30ce-45fe-9dac-220fefc06541", "Dean - Claude Desktop");
await generateMCPKey("ccfe2237-3899-49f5-99c9-8212b7021d18", "Eric - Claude Desktop");

await sql.end();
