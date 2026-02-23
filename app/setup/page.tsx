// app/setup/page.tsx
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function hasAnyUsers(): Promise<boolean> {
  const rows = await sql`select 1 from app_users limit 1`;
  return (rows as any[]).length > 0;
}

async function createFirstTenantAndUser(formData: FormData) {
  "use server";

  // Setup is only allowed if there are no users yet.
  if (await hasAnyUsers()) redirect("/login");

  const tenantNameRaw = String(formData.get("tenantName") ?? "").trim();
  const tenantName = tenantNameRaw || "ValleLogic";

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  if (!email) {
    throw new Error("Admin email is required.");
  }
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  const slug = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create tenant OR reuse existing by slug (idempotent)
  const t = await sql`
    insert into tenants (name, slug)
    values (${tenantName}, ${slug})
    on conflict (slug)
    do update set name = excluded.name
    returning id
  `;
  const tenantId = (t as any[])[0]?.id;
  if (!tenantId) throw new Error("Failed to create or load tenant.");

  // Avoid duplicate user creation if the form was double-submitted
  const existing = await sql`
    select id
    from app_users
    where email = ${email}
    limit 1
  `;
  if ((existing as any[]).length > 0) {
    // If user already exists, treat setup as complete and send to login.
    redirect("/login");
  }

  const hash = await bcrypt.hash(password, 12);

  await sql`
    insert into app_users (email, name, password_hash, tenant_id)
    values (${email}, ${"Admin"}, ${hash}, ${tenantId})
  `;

  redirect("/login");
}

export default async function SetupPage() {
  const anyUsers = await hasAnyUsers();

  if (anyUsers) {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Setup already completed</h1>
        <p>
          Users exist. Go to <a href="/login">/login</a>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        Create first tenant + admin user
      </h1>

      <form action={createFirstTenantAndUser}>
        <div style={{ marginBottom: 10 }}>
          <input
            name="tenantName"
            placeholder="Tenant name (e.g., ValleLogic)"
            style={{ width: "100%", padding: 10 }}
            defaultValue="ValleLogic"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            name="email"
            placeholder="Admin email"
            style={{ width: "100%", padding: 10 }}
            autoComplete="email"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            name="password"
            type="password"
            placeholder="Admin password (10+ chars)"
            style={{ width: "100%", padding: 10 }}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" style={{ width: "100%", padding: 10 }}>
          Create
        </button>
      </form>

      <div style={{ marginTop: 12, opacity: 0.8 }}>
        After creating the admin, you’ll be redirected to{" "}
        <a href="/login">/login</a>.
      </div>
    </div>
  );
}

