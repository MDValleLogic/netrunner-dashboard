import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireTenantSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new AuthError("Unauthorized", 401);

  const tenantId = (session.user as any).tenantId as string | undefined;
  if (!tenantId) throw new AuthError("No tenantId on session", 401);

  return { session, tenantId };
}

