"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Sign in</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          const res = await signIn("credentials", { email, password, redirect: false });
          if (res?.error) setErr("Invalid email or password");
          else window.location.href = "/netrunner/dashboard";
        }}
      >
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><br /><br />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} /><br /><br />
        {err && <div style={{ color: "red" }}>{err}</div>}
        <button>Sign in</button>
      </form>
    </div>
  );
}

