"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginContent() {
  const searchParams = useSearchParams();
  const verified     = searchParams.get("verified") === "true";

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
    if (res?.error) {
      setErr("Invalid email or password");
      return;
    }
    // Check MFA status — redirect to setup if not yet enabled
    const me = await fetch("/api/auth/me").then(r => r.json());
    if (me?.mfa_enabled === false) {
      window.location.href = "/mfa-setup";
    } else {
      window.location.href = "/devices";
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lp-wrap {
          min-height: 100vh;
          background: #020818;
          color: #f0f4f8;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
        }
        .lp-wrap::before {
          content: '';
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(14,165,233,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .lp-glow {
          position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
          width: 700px; height: 300px;
          background: radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .lp-inner {
          position: relative; z-index: 1;
          width: 100%; max-width: 440px;
        }
        .lp-logo {
          display: flex; flex-direction: column; align-items: center;
          margin-bottom: 32px;
        }
        .lp-logo-mark {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
          box-shadow: 0 8px 32px rgba(14,165,233,0.25);
        }
        .lp-logo-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          letter-spacing: -0.02em; color: #f0f4f8;
        }
        .lp-logo-sub {
          font-family: 'Space Mono', monospace;
          font-size: 10px; letter-spacing: 0.15em;
          color: #64748b; margin-top: 4px;
        }
        .lp-verified {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 20px;
          font-family: 'Space Mono', monospace;
          font-size: 11px; color: #22c55e;
          letter-spacing: 0.05em;
        }
        .lp-card {
          background: #060f1e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 36px 32px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .lp-card h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700;
          color: #f0f4f8; margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .lp-card p {
          font-size: 13px; color: #64748b; margin-bottom: 28px;
        }
        .lp-card p a { color: #0ea5e9; text-decoration: none; }
        .lp-card p a:hover { text-decoration: underline; }
        .lp-field { margin-bottom: 16px; }
        .lp-field label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 10px; letter-spacing: 0.15em;
          color: #64748b; margin-bottom: 7px;
        }
        .lp-field input {
          width: 100%;
          background: #0a1628;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 11px 14px;
          font-family: 'Space Mono', monospace;
          font-size: 13px; color: #f0f4f8;
          outline: none; transition: border-color 0.15s;
        }
        .lp-field input:focus {
          border-color: #0ea5e9; background: #0d1e35;
        }
        .lp-field input::placeholder { color: #334155; }
        .lp-err {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px; padding: 10px 14px;
          font-family: 'Space Mono', monospace;
          font-size: 11px; color: #f87171;
          margin-bottom: 16px;
        }
        .lp-btn {
          width: 100%; background: #0ea5e9;
          border: none; border-radius: 8px; padding: 13px;
          font-family: 'Space Mono', monospace;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.08em; color: #fff;
          cursor: pointer; margin-top: 8px;
          transition: all 0.2s;
        }
        .lp-btn:hover:not(:disabled) {
          background: #38bdf8;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(14,165,233,0.3);
        }
        .lp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .lp-footer {
          text-align: center; margin-top: 24px;
          font-family: 'Space Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; color: #334155;
          line-height: 1.8;
        }
        .lp-footer a { color: #0ea5e9; text-decoration: none; }
        .lp-footer a:hover { text-decoration: underline; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="lp-wrap">
        <div className="lp-glow" />
        <div className="lp-inner">
          <div className="lp-logo">
            <div className="lp-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="lp-logo-name">ValleLogic</div>
            <div className="lp-logo-sub">NETRUNNER PLATFORM</div>
          </div>

          {verified && (
            <div className="lp-verified">
              <span>✓</span>
              <span>EMAIL VERIFIED — sign in to continue setup</span>
            </div>
          )}

          <div className="lp-card">
            <h2>Sign in to your account</h2>
            <p>New to ValleLogic? <Link href="/register">Create an account →</Link></p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="lp-field">
                <label>EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErr(""); }}
                  required autoComplete="email" autoFocus
                />
              </div>
              <div className="lp-field">
                <label>PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErr(""); }}
                  required autoComplete="current-password"
                />
              </div>

              {err && <div className="lp-err">⚠ {err}</div>}

              <button type="submit" className="lp-btn" disabled={loading}>
                {loading ? "SIGNING IN…" : "SIGN IN TO NETRUNNER →"}
              </button>
            </form>
          </div>

          <div className="lp-footer">
            <Link href="https://vallelogic.com">← Back to vallelogic.com</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginContent /></Suspense>;
}
