"use client";
import React from "react";

export function ChangePasswordButton() {
  const [open, setOpen]       = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext]       = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving]   = React.useState(false);
  const [error, setError]     = React.useState("");
  const [success, setSuccess] = React.useState(false);

  async function handleSave() {
    setError("");
    if (next.length < 10) { setError("New password must be 10+ characters"); return; }
    if (next !== confirm)  { setError("Passwords do not match"); return; }
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to change password"); return; }
    setSuccess(true);
    setTimeout(() => { setOpen(false); setSuccess(false); setCurrent(""); setNext(""); setConfirm(""); }, 1500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "none", border: "1px solid var(--border-mid)",
          borderRadius: 6, padding: "4px 10px",
          fontSize: 11, color: "var(--text-dim)", cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        Change Password
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 25px 50px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Change Password</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>Update your account password</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {([
                { label: "Current Password", value: current, set: setCurrent },
                { label: "New Password (10+ characters)", value: next, set: setNext },
                { label: "Confirm New Password", value: confirm, set: setConfirm },
              ] as { label: string; value: string; set: (v: string) => void }[]).map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</label>
                  <input
                    type="password"
                    value={value}
                    onChange={e => set(e.target.value)}
                    autoComplete="new-password"
                    style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-mid)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              ))}
            </div>
            {error   && <div style={{ marginTop: 12, fontSize: 12, color: "#ef4444" }}>{error}</div>}
            {success && <div style={{ marginTop: 12, fontSize: 12, color: "#10b981" }}>\u2713 Password updated successfully</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setOpen(false); setError(""); }} style={{ flex: 1, padding: 10, background: "none", border: "1px solid var(--border-mid)", borderRadius: 8, color: "var(--text-dim)", cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, background: "var(--accent)", border: "none", borderRadius: 8, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving\u2026" : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
