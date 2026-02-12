"use client";

import { useEffect, useState } from "react";

type Config = {
  device_id: string;
  urls: string[];
  interval_seconds: number;
  updated_at: string | null;
};

export default function WebRunnerConfig() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [urlsText, setUrlsText] = useState("");
  const [interval, setInterval] = useState(300);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function safeJson(res: Response) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: "non_json_response", raw: text.slice(0, 300) };
    }
  }

  async function load() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch(`/api/webrunner/config?device_id=${encodeURIComponent(deviceId)}`, {
        cache: "no-store",
      });
      const j: any = await safeJson(r);
      if (!r.ok || !j.ok) {
        setErr(j.error || j.raw || `HTTP ${r.status}`);
        return;
      }

      const cfg: Config = j.config;
      setInterval(cfg.interval_seconds ?? 300);
      setUrlsText((cfg.urls ?? []).join("\n"));
      setUpdatedAt(cfg.updated_at ?? null);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setErr("");
    setMsg("");

    // NOTE: do not clear the textarea on save; preserve user input
    const urls = urlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const r = await fetch("/api/webrunner/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          urls,
          interval_seconds: interval,
        }),
      });

      const j: any = await safeJson(r);
      if (!r.ok || !j.ok) {
        setErr(j.error || j.raw || `HTTP ${r.status}`);
        return;
      }

      const cfg: Config = j.config;
      setInterval(cfg.interval_seconds ?? interval);
      setUrlsText((cfg.urls ?? []).join("\n"));
      setUpdatedAt(cfg.updated_at ?? null);

      setMsg(`Saved: ${cfg.urls?.length ?? 0} URL(s), interval ${cfg.interval_seconds}s. Pi will pick it up next cycle.`);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>WebRunner Config</h1>
      <div style={{ marginTop: 6, opacity: 0.75 }}>
        Authenticated admin control of URL list + interval.
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.75 }}>Device</span>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={input}
            spellCheck={false}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.75 }}>Interval (sec)</span>
          <input
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value || "300", 10) || 300)}
            style={{ ...input, width: 120 }}
            inputMode="numeric"
          />
        </label>

        <button onClick={load} style={btn} disabled={loading}>
          {loading ? "…" : "Reload"}
        </button>

        <button onClick={save} style={{ ...btn, fontWeight: 800 }} disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
        Last updated:{" "}
        <span style={mono}>{updatedAt ? new Date(updatedAt).toISOString() : "—"}</span>
      </div>

      {err ? <div style={bad}>{err}</div> : null}
      {msg ? <div style={ok}>{msg}</div> : null}

      <textarea
        value={urlsText}
        onChange={(e) => setUrlsText(e.target.value)}
        rows={12}
        placeholder={"One URL per line\nhttps://example.com\nhttps://vallelogic.com"}
        style={ta}
        spellCheck={false}
      />

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Tip: include https:// on each line.
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const btn: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const ta: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
};

const bad: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #ffd0d0",
  background: "#fff3f3",
  whiteSpace: "pre-wrap",
};

const ok: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #cfead8",
  background: "#f3fff6",
  whiteSpace: "pre-wrap",
};

const mono: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};
