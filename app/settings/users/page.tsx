import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function addUser(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || "User";
  const password = String(formData.get("password") ?? "");
  const tenantId = (session.user as any).tenantId;

  if (!email || password.length < 10) return;

  const existing = await sql`select id from app_users where email = ${email} limit 1`;
  if ((existing as any[]).length > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await sql`
    insert into app_users (email, name, password_hash, tenant_id)
    values (${email}, ${name}, ${hash}, ${tenantId})
  `;
  redirect("/settings/users");
}

async function deleteUser(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = String(formData.get("userId") ?? "");
  const currentUserEmail = session.user?.email ?? "";
  const tenantId = (session.user as any).tenantId;

  // Don't allow deleting yourself
  const target = await sql`select email from app_users where id = ${userId} and tenant_id = ${tenantId} limit 1`;
  if ((target as any[])[0]?.email === currentUserEmail) return;

  await sql`delete from app_users where id = ${userId} and tenant_id = ${tenantId}`;
  redirect("/settings/users");
}

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const tenantId = (session.user as any).tenantId;
  const users = await sql`
    select id, email, name, created_at
    from app_users
    where tenant_id = ${tenantId}
    order by created_at asc
  ` as any[];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
      `}</style>

      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">User Management</div>
          <div className="vl-topbar-sub">Manage team access to your NetRunner dashboard</div>
        </div>
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Current Users */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Team Members</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{users.length} user{users.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="vl-card-body" style={{ padding: 0 }}>
            {users.map((u, i) => (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 20px",
                borderBottom: i < users.length - 1 ? "1px solid var(--border-dim)" : "none",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #0f1f3d, #0d7a8a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                }}>
                  {(u.name || u.email)[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {u.name}
                    {u.email === session.user?.email && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 4,
                        background: "rgba(13,122,138,0.1)", color: "var(--accent)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>You</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {u.email}
                  </div>
                </div>

                {/* Joined */}
                <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", flexShrink: 0 }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </div>

                {/* Delete — can't delete yourself */}
                {u.email !== session.user?.email && (
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" style={{
                      background: "none", border: "1px solid var(--border-mid)",
                      borderRadius: 6, padding: "4px 10px",
                      fontSize: 11, color: "var(--text-dim)", cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = "#ef4444", e.currentTarget.style.color = "#ef4444")}
                    onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border-mid)", e.currentTarget.style.color = "var(--text-dim)")}
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add User Form */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Add Team Member</span>
          </div>
          <div className="vl-card-body">
            <form action={addUser}>
              <div className="vl-grid-2" style={{ marginBottom: 14 }}>
                <div>
                  <label className="vl-label">Full name</label>
                  <input className="vl-input" name="name" type="text" placeholder="Jane Smith" required />
                </div>
                <div>
                  <label className="vl-label">Email address</label>
                  <input className="vl-input" name="email" type="email" placeholder="jane@example.com" required />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="vl-label">Temporary password <span style={{ color: "var(--text-dim)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(10+ characters)</span></label>
                <input className="vl-input" name="password" type="password" placeholder="They can change this after signing in" required />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="submit" className="vl-btn vl-btn-primary">
                  + Add User
                </button>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  User will be added to your ValleLogic tenant
                </span>
              </div>
            </form>
          </div>
        </div>

        {/* Coming soon note */}
        <div style={{
          padding: "14px 18px",
          background: "rgba(13,122,138,0.05)",
          border: "1px solid rgba(13,122,138,0.15)",
          borderRadius: 10,
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
        }}>
          ⓘ <strong>Coming in Phase 2:</strong> SSO, MFA, and role-based access control (RBAC). Users will be able to set their own passwords via email invite.
        </div>

      </div>
    </>
  );
}
