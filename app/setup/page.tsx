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
  if (await hasAnyUsers()) redirect("/login");

  const tenantNameRaw = String(formData.get("tenantName") ?? "").trim();
  const tenantName = tenantNameRaw || "ValleLogic";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email) throw new Error("Admin email is required.");
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");

  const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const t = await sql`
    insert into tenants (name, slug)
    values (${tenantName}, ${slug})
    on conflict (slug) do update set name = excluded.name
    returning id
  `;
  const tenantId = (t as any[])[0]?.id;
  if (!tenantId) throw new Error("Failed to create or load tenant.");

  const existing = await sql`select id from app_users where email = ${email} limit 1`;
  if ((existing as any[]).length > 0) redirect("/login");

  const hash = await bcrypt.hash(password, 12);
  await sql`insert into app_users (email, name, password_hash, tenant_id) values (${email}, ${"Admin"}, ${hash}, ${tenantId})`;
  redirect("/login");
}

export default async function SetupPage() {
  const anyUsers = await hasAnyUsers();

  if (anyUsers) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          body { margin: 0; background: #f4f6f8; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .setup-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
          .setup-card { background: #fff; border: 1px solid #e2e6f0; border-radius: 16px; padding: 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(15,31,61,0.07); }
          .setup-card h1 { font-size: 20px; font-weight: 700; color: #0f1f3d; margin: 0 0 10px; }
          .setup-card p { font-size: 14px; color: #8892aa; margin: 0 0 24px; }
          .setup-btn { display: inline-block; padding: 11px 24px; background: #0f1f3d; color: #fff; border-radius: 9px; font-size: 14px; font-weight: 600; text-decoration: none; }
        `}</style>
        <div className="setup-wrap">
          <div className="setup-card">
            <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
            <h1>Setup already completed</h1>
            <p>Your ValleLogic account is ready. Sign in to access your NetRunner dashboard.</p>
            <a href="/login" className="setup-btn">Go to Login →</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        .setup-wrap {
          min-height: 100vh;
          background: #f4f6f8;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        .setup-bg {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(13,122,138,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13,122,138,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .setup-blob {
          position: fixed; top: -120px; right: -120px; z-index: 0;
          width: 480px; height: 480px; border-radius: 50%;
          background: radial-gradient(circle, rgba(13,122,138,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .setup-inner { position: relative; z-index: 1; width: 100%; max-width: 460px; }
        .setup-logo {
          display: flex; flex-direction: column; align-items: center;
          margin-bottom: 28px; gap: 10px;
        }
        .setup-logo img { width: 180px; height: auto; }
        .setup-logo-sub {
          font-size: 11px; font-weight: 600; color: #6b7a99;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .setup-card {
          background: #fff;
          border: 1px solid #e2e6f0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 24px rgba(15,31,61,0.07), 0 1px 3px rgba(0,0,0,0.04);
        }
        .setup-card-accent {
          height: 3px;
          background: linear-gradient(90deg, #0d7a8a, #0f1f3d);
          border-radius: 16px 16px 0 0;
          margin: -32px -32px 28px -32px;
        }
        .setup-card h2 { font-size: 18px; font-weight: 700; color: #0f1f3d; margin: 0 0 6px; letter-spacing: -0.01em; }
        .setup-card p { font-size: 13px; color: #8892aa; margin: 0 0 28px; line-height: 1.5; }
        .setup-label {
          display: block; font-size: 10px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          color: #8892aa; margin-bottom: 6px;
        }
        .setup-input {
          width: 100%; padding: 10px 13px;
          background: #f7f9fc; border: 1px solid #e2e6f0;
          border-radius: 8px; color: #0f1f3d;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 14px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .setup-input:focus {
          border-color: #0d7a8a;
          box-shadow: 0 0 0 3px rgba(13,122,138,0.12);
          background: #fff;
        }
        .setup-field { margin-bottom: 16px; }
        .setup-divider {
          height: 1px; background: #e2e6f0;
          margin: 20px 0; position: relative;
        }
        .setup-divider span {
          position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
          background: #fff; padding: 0 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
          text-transform: uppercase; color: #b0b8cc;
        }
        .setup-btn {
          width: 100%; padding: 12px 20px;
          background: #0f1f3d; color: #fff;
          border: none; border-radius: 9px;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; margin-top: 8px;
          transition: all 0.18s; letter-spacing: -0.01em;
        }
        .setup-btn:hover {
          background: #0d7a8a;
          box-shadow: 0 6px 20px rgba(13,122,138,0.3);
          transform: translateY(-1px);
        }
        .setup-note {
          margin-top: 16px; padding: 12px 14px;
          background: rgba(13,122,138,0.06);
          border: 1px solid rgba(13,122,138,0.15);
          border-radius: 8px;
          font-size: 12px; color: #6b7a99; line-height: 1.5;
        }
        .setup-footer { text-align: center; margin-top: 20px; font-size: 12px; color: #8892aa; }
        .setup-footer a { color: #0d7a8a; font-weight: 500; text-decoration: none; }
        .setup-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="setup-wrap">
        <div className="setup-bg" />
        <div className="setup-blob" />
        <div className="setup-inner">

          <div className="setup-logo">
            <img src="/vallelogic-logo-color.png" alt="ValleLogic" />
            <div className="setup-logo-sub">Initial Setup</div>
          </div>

          <div className="setup-card">
            <div className="setup-card-accent" />
            <h2>Create your account</h2>
            <p>Set up your ValleLogic tenant and admin account. This page is only available once.</p>

            <form action={createFirstTenantAndUser}>
              <div className="setup-field">
                <label className="setup-label">Organization name</label>
                <input className="setup-input" name="tenantName" placeholder="e.g. ValleLogic" defaultValue="ValleLogic" />
              </div>

              <div className="setup-divider"><span>Admin Account</span></div>

              <div className="setup-field">
                <label className="setup-label">Admin email</label>
                <input className="setup-input" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              </div>

              <div className="setup-field">
                <label className="setup-label">Password</label>
                <input className="setup-input" name="password" type="password" placeholder="10+ characters" autoComplete="new-password" required />
              </div>

              <button type="submit" className="setup-btn">
                Create Account → 
              </button>
            </form>

            <div className="setup-note">
              ⓘ After setup you'll be redirected to the login page. Additional users can be added from Settings after signing in.
            </div>
          </div>

          <div className="setup-footer">
            Already have an account? <a href="/login">Sign in →</a>
          </div>
        </div>
      </div>
    </>
  );
}
