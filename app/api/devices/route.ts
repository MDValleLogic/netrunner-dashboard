import { sql } from "@/lib/db";
import { requireTenantSession } from "@/lib/requireTenantSession";
import { setTenantScope } from "@/lib/tenantScope";

export const runtime = "nodejs";

export async function GET() {
  const { tenantId } = await requireTenantSession();
  await setTenantScope(tenantId);

  const rows = await sql`
    select device_id, updated_at
    from devices
    order by updated_at desc nulls last, device_id asc
  `;

  return Response.json({
    ok: true,
    devices: rows,
  });
}

