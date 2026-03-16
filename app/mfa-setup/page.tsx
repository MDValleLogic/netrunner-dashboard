"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "loading" | "scan" | "verify" | "done" | "error";

export default function MfaSetupPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>("loading");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret]     = useState("");
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [pageError, setPageError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function setup() {
      try {
        const res  = await fetch("/api/auth/mfa/setup");
        const data = await res.json();
        if (!res.ok) { setPageError(data.error ?? "Failed to initialize MFA"); setStep("error"); return; }
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
        setStep("scan");
      } catch {
        setPageError("Network error — please refresh");
        setStep("error");
      }
    }
    setup();
  }, []);

  useEffect(() => {
    if (step === "verify") setTimeout(() => inputRef.current?.focus(), 50);
  }, [step]);

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
    setError("");
    if (val.length === 6) submitCode(val);
  }

  async function submitCode(codeVal = code) {
    if (codeVal.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeVal }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Incorrect code"); setCode(""); inputRef.current?.focus(); return; }
      setStep("done");
      setTimeout(() => router.replace("/settings/devices"), 1800);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const formattedSecret = secret ? (secret.match(/.{1,4}/g)?.join(" ") ?? secret) : "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .mfa-wrap {
          min-height: 100vh;
          background: #020818;
          color: #f0f4f8;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .mfa-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(14,165,233,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .mfa-inner { position: relative; z-index: 1; width: 100%; max-width: 500px; }
        .mfa-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
        .mfa-logo-mark { width: 44px; height: 44px; background: linear-gradient(135deg,#0ea5e9,#0369a1); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 8px 32px rgba(14,165,233,0.25); }
        .mfa-logo-name { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .mfa-logo-sub  { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #64748b; margin-top: 3px; }
        .mfa-card { background: #060f1e; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.4); }
        .mfa-steps { display: flex; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .mfa-step { flex: 1; padding: 13px 0; text-align: center; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: #334155; border-right: 1px solid rgba(255,255,255,0.06); position: relative; }
        .mfa-step:last-child { border-right: none; }
        .mfa-step.active { color: #0ea5e9; background: rgba(14,165,233,0.05); }
        .mfa-step.done   { color: #22c55e; }
        .mfa-step.active::after,.mfa-step.done::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; }
        .mfa-step.active::after { background: #0ea5e9; }
        .mfa-step.done::after   { background: #22c55e; }
        .mfa-body { padding: 36px 36px 32px; }
        .mfa-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #f0f4f8; margin-bottom: 8px; }
        .mfa-sub { font-size: 14px; color: #64748b; line-height: 1.65; margin-bottom: 24px; }
        .mfa-instructions { background: rgba(14,165,233,0.05); border: 1px solid rgba(14,165,233,0.12); border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; }
        .mfa-instructions ol { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .mfa-instructions li { font-family: 'Space Mono', monospace; font-size: 11px; color: #94a3b8; line-height: 1.5; display: flex; gap: 10px; align-items: flex-start; }
        .mfa-instructions li span.num { color: #0ea5e9; font-weight: 700; flex-shrink: 0; }
        .mfa-dl-links { display: flex; gap: 8px; margin-top: 10px; }
        .mfa-dl-link { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: #0a1628; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.08em; color: #64748b; text-decoration: none; transition: all 0.15s; }
        .mfa-dl-link:hover { border-color: #0ea5e9; color: #0ea5e9; }
        .mfa-qr-wrap { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
        .mfa-qr { width: 156px; height: 156px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .mfa-qr-skeleton { width: 156px; height: 156px; background: #0a1628; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; animation: mfaPulse 1.4s infinite; }
        .mfa-qr-info h4 { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.12em; color: #64748b; margin-bottom: 8px; }
        .mfa-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .mfa-pill { background: #0a1628; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 4px 8px; font-family: 'Space Mono', monospace; font-size: 10px; color: #475569; }
        .mfa-key-label { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: #475569; margin-bottom: 5px; }
        .mfa-key { background: #020818; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 8px 10px; font-family: 'Space Mono', monospace; font-size: 11px; color: #94a3b8; word-break: break-all; line-height: 1.5; }
        .mfa-btn-pri { width: 100%; background: #0ea5e9; border: none; border-radius: 8px; padding: 14px; font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #fff; cursor: pointer; transition: all 0.2s; }
        .mfa-btn-pri:hover:not(:disabled) { background: #38bdf8; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(14,165,233,0.3); }
        .mfa-btn-pri:disabled { opacity: 0.5; cursor: not-allowed; }
        .mfa-btn-sec { width: 100%; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; cursor: pointer; transition: all 0.15s; }
        .mfa-btn-sec:hover { border-color: #0ea5e9; color: #0ea5e9; }
        .mfa-code-label { display: block; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #64748b; margin-bottom: 10px; }
        .mfa-code-input { width: 100%; background: #020818; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; font-family: 'Space Mono', monospace; font-size: 32px; letter-spacing: 0.5em; color: #f0f4f8; text-align: center; outline: none; transition: border-color 0.15s; margin-bottom: 16px; }
        .mfa-code-input:focus { border-color: #0ea5e9; }
        .mfa-code-input::placeholder { font-size: 20px; letter-spacing: 0.3em; color: #1e293b; }
        .mfa-back { display: block; text-align: center; margin-top: 14px; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: #334155; background: none; border: none; cursor: pointer; width: 100%; }
        .mfa-back:hover { color: #64748b; }
        .mfa-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 10px 14px; font-family: 'Space Mono', monospace; font-size: 11px; color: #f87171; margin-bottom: 14px; }
        .mfa-done { padding: 56px 36px; text-align: center; }
        .mfa-done-icon { width: 72px; height: 72px; border-radius: 50%; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 20px; }
        .mfa-done h2 { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #f0f4f8; margin-bottom: 8px; }
        .mfa-done p { font-size: 14px; color: #64748b; }
        @keyframes mfaPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div className="mfa-wrap">
        <div className="mfa-inner">
          <div className="mfa-logo">
            <div className="mfa-logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mfa-logo-name">ValleLogic</div>
            <div className="mfa-logo-sub">NETRUNNER PLATFORM</div>
          </div>

          <div className="mfa-card">
            {step === "done" && (
              <div className="mfa-done">
                <div className="mfa-done-icon">✓</div>
                <h2>You're all set</h2>
                <p>MFA enabled. Taking you to your dashboard…</p>
              </div>
            )}

            {step === "error" && (
              <div className="mfa-done">
                <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
                <h2 style={{ marginBottom: 8 }}>Setup error</h2>
                <p>{pageError}</p>
                <a href="/register" style={{ display:"inline-block", marginTop:24, fontFamily:"'Space Mono',monospace", fontSize:11, color:"#0ea5e9", textDecoration:"none", letterSpacing:"0.1em" }}>← START OVER</a>
              </div>
            )}

            {(step === "loading" || step === "scan" || step === "verify") && (
              <>
                <div className="mfa-steps">
                  <div className="mfa-step done">01 ACCOUNT</div>
                  <div className="mfa-step done">02 EMAIL</div>
                  <div className={`mfa-step ${step === "scan" ? "active" : step === "verify" ? "done" : ""}`}>03 SCAN QR</div>
                  <div className={`mfa-step ${step === "verify" ? "active" : ""}`}>04 VERIFY</div>
                </div>

                {step === "scan" && (
                  <div className="mfa-body">
                    <div className="mfa-title">Set up authenticator</div>
                    <div className="mfa-sub">You'll need an authenticator app on your phone to secure your account.</div>

                    <div className="mfa-instructions">
                      <ol>
                        <li><span className="num">1</span><span>Download Google Authenticator or Authy on your phone</span></li>
                        <li><span className="num">2</span><span>Open the app, tap <strong style={{color:"#f0f4f8"}}>+</strong> or <strong style={{color:"#f0f4f8"}}>Add account</strong></span></li>
                        <li><span className="num">3</span><span>Choose <strong style={{color:"#f0f4f8"}}>Scan a QR code</strong> and point your camera at the code below</span></li>
                      </ol>
                      <div className="mfa-dl-links">
                        <a className="mfa-dl-link" href="https://apps.apple.com/us/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">
                          🍎 APP STORE
                        </a>
                        <a className="mfa-dl-link" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">
                          🤖 GOOGLE PLAY
                        </a>
                      </div>
                    </div>

                    <div className="mfa-qr-wrap">
                      {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" className="mfa-qr" /> : <div className="mfa-qr-skeleton" />}
                      <div className="mfa-qr-info">
                        <h4>COMPATIBLE APPS</h4>
                        <div className="mfa-pills">
                          <span className="mfa-pill">Google Auth</span>
                          <span className="mfa-pill">Authy</span>
                          <span className="mfa-pill">1Password</span>
                          <span className="mfa-pill">Bitwarden</span>
                        </div>
                        <div className="mfa-key-label">MANUAL ENTRY KEY</div>
                        <div className="mfa-key">{formattedSecret || "…"}</div>
                      </div>
                    </div>

                    <button className="mfa-btn-pri" onClick={() => setStep("verify")}>
                      I'VE SCANNED IT — CONTINUE →
                    </button>
                  </div>
                )}

                {step === "verify" && (
                  <div className="mfa-body">
                    <div className="mfa-title">Enter the code</div>
                    <div className="mfa-sub">Open your authenticator app and enter the 6-digit code for <strong style={{ color:"#94a3b8" }}>ValleLogic</strong>.</div>
                    {error && <div className="mfa-error">⚠ {error}</div>}
                    <label className="mfa-code-label">6-DIGIT CODE</label>
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={handleCodeChange}
                      className="mfa-code-input"
                      autoComplete="one-time-code"
                    />
                    <button className="mfa-btn-pri" disabled={loading || code.length !== 6} onClick={() => submitCode()}>
                      {loading ? "VERIFYING…" : "CONFIRM & ACTIVATE →"}
                    </button>
                    <button className="mfa-back" onClick={() => { setStep("scan"); setCode(""); setError(""); }}>
                      ← BACK TO QR CODE
                    </button>
                  </div>
                )}

                {step === "loading" && (
                  <div className="mfa-body">
                    <div className="mfa-qr-wrap">
                      <div className="mfa-qr-skeleton" />
                      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, paddingTop:8 }}>
                        <div style={{ height:10, background:"#0a1628", borderRadius:3, animation:"mfaPulse 1.4s infinite" }} />
                        <div style={{ height:10, background:"#0a1628", borderRadius:3, width:"70%", animation:"mfaPulse 1.4s infinite" }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
