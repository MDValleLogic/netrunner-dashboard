"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setErr("Invalid email or password");
    else window.location.href = "/netrunner/dashboard";
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-ui)",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(13,122,138,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(13,122,138,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "36px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
            boxShadow: "0 0 32px var(--accent-glow)",
          }}>
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2.5" fill="white"/>
              <circle cx="3" cy="4" r="1.8" fill="rgba(255,255,255,0.6)"/>
              <circle cx="17" cy="4" r="1.8" fill="rgba(255,255,255,0.6)"/>
              <circle cx="3" cy="16" r="1.8" fill="rgba(255,255,255,0.6)"/>
              <circle cx="17" cy="16" r="1.8" fill="rgba(255,255,255,0.6)"/>
              <line x1="10" y1="10" x2="3" y2="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3"/>
              <line x1="10" y1="10" x2="17" y2="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3"/>
              <line x1="10" y1="10" x2="3" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3"/>
              <line x1="10" y1="10" x2="17" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
            ValleLogic
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginTop: 4 }}>
            NetRunner Dashboard
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-mid)",
          borderRadius: 16,
          padding: "32px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.01em" }}>
            Sign in to your account
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28 }}>
            Access your NetRunner dashboard and device data.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label className="vl-label">Email address</label>
              <input
                className="vl-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label className="vl-label">Password</label>
              <input
                className="vl-input"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {/* Error */}
            {err && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px",
                background: "var(--red-dim)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                color: "#fca5a5",
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.5" stroke="#ef4444" strokeWidth="1.2"/>
                  <path d="M7 4v3.5M7 9.5v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {err}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="vl-btn vl-btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "11px 20px", fontSize: 14 }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>Sign in to NetRunner →</>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--text-dim)" }}>
          <a href="https://vallelogic.com" style={{ color: "var(--accent-lt)", fontWeight: 500, textDecoration: "none" }}>
            ← Back to vallelogic.com
          </a>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
