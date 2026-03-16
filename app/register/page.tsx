"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "form" | "sent";

export default function RegisterPage() {
  const [step, setStep]         = useState<Step>("form");
  const [name, setName]         = useState("");
  const [orgName, setOrgName]   = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orgName, email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed"); return; }
      setSentEmail(email.trim().toLowerCase());
      setStep("sent");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const pwOk  = password.length >= 8;
  const pwUp  = /[A-Z]/.test(password);
  const pwNum = /[0-9]/.test(password);
  const pwMatch = password === confirm && confirm.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .rp-wrap {
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

        .rp-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(14,165,233,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        .rp-glow {
          position: fixed;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .rp-inner {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
        }

        /* Logo */
        .rp-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
        }

        .rp-logo-mark {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          box-shadow: 0 8px 32px rgba(14,165,233,0.25);
        }

        .rp-logo-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #f0f4f8;
        }

        .rp-logo-sub {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          color: #64748b;
          margin-top: 4px;
        }

        /* Card */
        .rp-card {
          background: #060f1e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 36px 32px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }

        .rp-card h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #f0f4f8;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }

        .rp-card p {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 28px;
        }

        .rp-card p a {
          color: #0ea5e9;
          text-decoration: none;
        }

        .rp-card p a:hover { text-decoration: underline; }

        /* Fields */
        .rp-field {
          margin-bottom: 16px;
        }

        .rp-field label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          color: #64748b;
          margin-bottom: 7px;
        }

        .rp-field input {
          width: 100%;
          background: #0a1628;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 11px 14px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #f0f4f8;
          outline: none;
          transition: border-color 0.15s;
        }

        .rp-field input:focus {
          border-color: #0ea5e9;
          background: #0d1e35;
        }

        .rp-field input::placeholder { color: #334155; }

        .rp-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* Password hints */
        .rp-hints {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 8px;
          margin-bottom: 4px;
        }

        .rp-hint {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rp-hint.ok   { color: #22c55e; }
        .rp-hint.fail { color: #334155; }

        /* Error */
        .rp-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 10px 14px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          color: #f87171;
          margin-bottom: 16px;
        }

        /* Button */
        .rp-btn {
          width: 100%;
          background: #0ea5e9;
          border: none;
          border-radius: 8px;
          padding: 13px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #fff;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
        }

        .rp-btn:hover:not(:disabled) {
          background: #38bdf8;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(14,165,233,0.3);
        }

        .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .rp-terms {
          margin-top: 20px;
          font-size: 11px;
          color: #334155;
          font-family: 'Space Mono', monospace;
          text-align: center;
          line-height: 1.6;
        }

        /* Sent screen */
        .rp-sent {
          text-align: center;
          padding: 16px 0;
        }

        .rp-sent-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(14,165,233,0.1);
          border: 1px solid rgba(14,165,233,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin: 0 auto 24px;
        }

        .rp-sent h2 {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #f0f4f8;
          margin-bottom: 12px;
        }

        .rp-sent p {
          font-size: 14px;
          color: #64748b;
          line-height: 1.7;
          margin-bottom: 20px;
        }

        .rp-sent-chip {
          display: inline-block;
          background: #0a1628;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 8px 16px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 28px;
        }

        .rp-sent-note {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.05em;
          color: #334155;
          line-height: 1.7;
        }

        .rp-sent-note a { color: #0ea5e9; text-decoration: none; }
      `}</style>

      <div className="rp-wrap">
        <div className="rp-glow" />
        <div className="rp-inner">

          {/* Logo */}
          <div className="rp-logo">
            <div className="rp-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="rp-logo-name">ValleLogic</div>
            <div className="rp-logo-sub">NETRUNNER PLATFORM</div>
          </div>

          <div className="rp-card">
            {step === "sent" ? (
              <div className="rp-sent">
                <div className="rp-sent-icon">✉</div>
                <h2>Check your email</h2>
                <p>We sent a verification link to:</p>
                <div className="rp-sent-chip">{sentEmail}</div>
                <p>Click the link to verify your address and set up two-factor authentication. It expires in 24 hours.</p>
                <div className="rp-sent-note">
                  Check your spam folder if you don't see it.<br />
                  Wrong email? <Link href="/register">Start over</Link>
                </div>
              </div>
            ) : (
              <>
                <h2>Create your account</h2>
                <p>Already have one? <Link href="/login">Sign in →</Link></p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="rp-row">
                    <div className="rp-field">
                      <label>YOUR NAME</label>
                      <input
                        type="text"
                        placeholder="Jane Smith"
                        value={name}
                        onChange={e => { setName(e.target.value); setError(""); }}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="rp-field">
                      <label>ORGANIZATION</label>
                      <input
                        type="text"
                        placeholder="Acme Corp"
                        value={orgName}
                        onChange={e => { setOrgName(e.target.value); setError(""); }}
                        required
                      />
                    </div>
                  </div>

                  <div className="rp-field">
                    <label>EMAIL ADDRESS</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(""); }}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="rp-row">
                    <div className="rp-field" style={{ marginBottom: 0 }}>
                      <label>PASSWORD</label>
                      <input
                        type="password"
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(""); }}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="rp-field" style={{ marginBottom: 0 }}>
                      <label>CONFIRM</label>
                      <input
                        type="password"
                        placeholder="Repeat password"
                        value={confirm}
                        onChange={e => { setConfirm(e.target.value); setError(""); }}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {password && (
                    <div className="rp-hints">
                      <span className={`rp-hint ${pwOk  ? "ok" : "fail"}`}>{pwOk  ? "✓" : "○"} 8+ chars</span>
                      <span className={`rp-hint ${pwUp  ? "ok" : "fail"}`}>{pwUp  ? "✓" : "○"} uppercase</span>
                      <span className={`rp-hint ${pwNum ? "ok" : "fail"}`}>{pwNum ? "✓" : "○"} number</span>
                      {confirm && <span className={`rp-hint ${pwMatch ? "ok" : "fail"}`}>{pwMatch ? "✓" : "✗"} match</span>}
                    </div>
                  )}

                  {error && <div className="rp-error" style={{ marginTop: 16 }}>⚠ {error}</div>}

                  <button type="submit" className="rp-btn" disabled={loading}>
                    {loading ? "CREATING ACCOUNT…" : "CREATE ACCOUNT →"}
                  </button>
                </form>

                <div className="rp-terms">
                  No spam · No vendor bias · Your hardware, your data
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
