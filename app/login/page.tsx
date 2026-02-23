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
    else window.location.href = "/dashboard";
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .login-wrap {
          min-height: 100vh;
          background: #f7f9fc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        .login-bg {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(13,122,138,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13,122,138,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .login-inner {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
        }
        .login-logo {
          display: flex; flex-direction: column; align-items: center;
          margin-bottom: 32px;
        }
        .login-logo-mark {
          width: 52px; height: 52px; border-radius: 14px;
          background: #0f1f3d;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
          box-shadow: 0 8px 24px rgba(15,31,61,0.2);
        }
        .login-logo-name {
          font-size: 22px; font-weight: 800; color: #0f1f3d;
          letter-spacing: -0.025em;
        }
        .login-logo-sub {
          font-size: 11px; font-weight: 600; color: #8892aa;
          letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px;
        }
        .login-card {
          background: #ffffff;
          border: 1px solid #e2e6f0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 24px rgba(15,31,61,0.08), 0 1px 4px rgba(0,0,0,0.04);
        }
        .login-card h2 {
          font-size: 18px; font-weight: 700; color: #0f1f3d;
          letter-spacing: -0.01em; margin: 0 0 6px;
        }
        .login-card p {
          font-size: 13px; color: #8892aa; margin: 0 0 28px;
        }
        .login-label {
          display: block; font-size: 10px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          color: #8892aa; margin-bottom: 6px;
        }
        .login-input {
          width: 100%; padding: 10px 13px;
          background: #f7f9fc;
          border: 1px solid #e2e6f0;
          border-radius: 8px;
          color: #0f1f3d;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .login-input:focus {
          border-color: #0d7a8a;
          box-shadow: 0 0 0 3px rgba(13,122,138,0.12);
          background: #fff;
        }
        .login-field { margin-bottom: 16px; }
        .login-field:last-of-type { margin-bottom: 24px; }
        .login-btn {
          width: 100%; padding: 12px 20px;
          background: #0f1f3d; color: #fff;
          border: none; border-radius: 9px;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.18s;
        }
        .login-btn:hover:not(:disabled) {
          background: #1a3260;
          box-shadow: 0 6px 20px rgba(15,31,61,0.25);
          transform: translateY(-1px);
        }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .login-err {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 13px;
          background: #fef2f2; border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px; margin-bottom: 18px;
          font-size: 13px; color: #dc2626;
        }
        .login-footer {
          text-align: center; margin-top: 22px;
          font-size: 12px;
        }
        .login-footer a {
          color: #0d7a8a; font-weight: 500; text-decoration: none;
        }
        .login-footer a:hover { text-decoration: underline; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-wrap">
        <div className="login-bg" />
        <div className="login-inner">

          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-mark">
              <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="2.8" fill="white"/>
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
            <div className="login-logo-name">ValleLogic</div>
            <div className="login-logo-sub">NetRunner Dashboard</div>
          </div>

          {/* Card */}
          <div className="login-card">
            <h2>Sign in to your account</h2>
            <p>Access your NetRunner dashboard and device data.</p>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-label">Email address</label>
                <input
                  className="login-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  className="login-input"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {err && (
                <div className="login-err">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#dc2626" strokeWidth="1.2"/>
                    <path d="M7 4v3M7 9.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {err}
                </div>
              )}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                      <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Signing in…
                  </>
                ) : "Sign in to NetRunner →"}
              </button>
            </form>
          </div>

          <div className="login-footer">
            <a href="https://vallelogic.com">← Back to vallelogic.com</a>
          </div>
        </div>
      </div>
    </>
  );
}
