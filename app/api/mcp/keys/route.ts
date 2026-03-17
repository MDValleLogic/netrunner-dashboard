import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { generateMCPKey, listMCPKeys, revokeMCPKey } from "@/lib/mcp/auth";

async function getTenantId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return (session.user as any).tenantId as string ?? null;
}

// GET /api/mcp/keys — list all active keys for the tenant
export async function GET(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await listMCPKeys(tenantId);
  return NextResponse.json({ keys });
}

// POST /api/mcp/keys — generate a new key
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label = String(body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const { rawKey, keyId } = await generateMCPKey(tenantId, label);
  return NextResponse.json({ rawKey, keyId });
}

// DELETE /api/mcp/keys?id=xxx — revoke a key
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyId = req.nextUrl.searchParams.get("id");
  if (!keyId) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

  const ok = await revokeMCPKey(keyId, tenantId);
  if (!ok) return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
