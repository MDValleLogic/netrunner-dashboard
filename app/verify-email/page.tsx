"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type State = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");
  const [state, setState] = useState<State>("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setError("No token found in this link."); return; }
    let cancelled = false;
    async function verify() {
      try {
        const res  = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) { setState("error"); setError(data.error ?? "Verification failed"); return; }
        setState("success");
        setTimeout(() => { if (!cancelled) router.replace("/mfa-setup"); }, 1200);
      } catch {
        if (!cancelled) { setState("error"); setError("Network error — please try again"); }
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [token, router]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ve-wrap {
          min-height: 100vh;
          background: #020818;
          color: #f0f4f8;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .ve-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(14,165,233,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .ve-card {
          position: relative;
          z-index: 1;
          max-width: 420px;
          width: 100%;
          background: #060f1e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 48px 40px;
          text-align: center;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .ve-wordmark {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          color: #0ea5e9;
          margin-bottom: 32px;
        }
        .ve-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin: 0 auto 24px;
        }
        .ve-icon.verifying { background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); animation: vePulse 1.4s ease-in-out infinite; }
        .ve-icon.success   { background: rgba(34,197,94,0.08);  border: 1px solid rgba(34,197,94,0.25); }
        .ve-icon.error     { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.25); }
        @keyframes vePulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        h1 { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #f0f4f8; margin-bottom: 10px; }
        p  { font-size: 14px; color: #64748b; line-height: 1.7; }
        .ve-err {
          margin-top: 20px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          padding: 12px 16px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          color: #f87171;
          text-align: left;
        }
        .ve-link { display: inline-block; margin-top: 24px; font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.1em; color: #0ea5e9; text-decoration: none; }
        .ve-link:hover { text-decoration: underline; }
      `}</style>
      <div className="ve-wrap">
        <div className="ve-card">
          <div className="ve-wordmark">VALLELOGIC / NETRUNNER</div>
          {state === "verifying" && (<><div className="ve-icon verifying">⟳</div><h1>Verifying your email</h1><p>Just a moment…</p></>)}
          {state === "success"   && (<><div className="ve-icon success">✓</div><h1>Email verified</h1><p>Setting up two-factor authentication…</p></>)}
          {state === "error"     && (<><div className="ve-icon error">✕</div><h1>Verification failed</h1><p>This link may have already been used or has expired.</p>{error && <div className="ve-err">⚠ {error}</div>}<a href="/register" className="ve-link">← CREATE A NEW ACCOUNT</a></>)}
        </div>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmailContent /></Suspense>;
}
