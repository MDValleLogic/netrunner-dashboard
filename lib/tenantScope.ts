import { sql } from "@/lib/db";

export async function setTenantScope(tenantId: string) {
  if (!tenantId) throw new Error("tenantId required");
  await sql`select set_config('app.tenant_id', ${tenantId}, true)`;
}

