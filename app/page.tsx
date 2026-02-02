"use client";

import { useEffect, useMemo, useState } from "react";

type NetRunnerStatus = {
  ok: boolean;
  error?: string;
  device_id: string;

  appliance: {
    online: boolean;
    last_seen_utc: string | null;
    last_seen_age_s: number | null;
    offline_after_s: number;
  };

  webrunner: {
    enabled: boolean;
    configured: boolean;
    interval_s: number;
    url_count: number;
    urls_preview?: string[];
  };

  last_measurement: null | {
    ts_utc: string;
    url: string;
    dns_ms: number;
    http_ms: number;
    http_err: string;
  };
};

function fmtAgo(iso?: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function NetRunnerHome() {
  const [deviceId, setDeviceId] = useState("pi-001");

  const [status, setStatus] = useState<NetRunnerStatus | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const webRunnerEnabled = useMemo(() => Boolean(status?.webrunner?.enabled), [status]);
  const webRunnerConfigured = useMemo(() => Boolean(status?.webrunner?.configured), [status]);

  async function refresh() {
    setErr("");
    setLoading(true);

    try {
      const res = await fetch(
        `/api/netrunner/status?device_id=${encodeURIComponent(deviceId)}`,
        { cache: "no-store" }
      );

      const j = (await res.json().catch(() => null)) as NetRunnerStatus | null;

      if (!res.ok || !j?.ok) {
        setStatus(null);
        setErr((j as any)?.error || `Status failed (${res.status})`);
        return;
      }

      setStatus(j);
    } catch (e: any) {
      setStatus(null);
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const online = Boolean(status?.appliance?.online);
  const lastSeenUtc = status?.appliance?.last_seen_utc ?? null;

  const last = status?.last_measurement ?? null;
  const lastSignal = last
    ? last.http_err
      ? `FAILED (${last.http_err})`
      : `OK • dns ${Math.round(last.dns_ms)}ms • http ${Math.round(last.http_ms)}ms`
    : "—";

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>ValleLogic • NetRunner</div>
          <h1 style={{ fontSize: 28, margin: 0 }}>NetRunner Home</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Operational truth: appliance health + WebRunner state.
          </div>
        </div>

        <a
          href="/dashboard"
          style={{
            background: "#1D4ED8",
            color: "white",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: online ? 1 : 0.75,
          }}
        >
          Open WebRunner
        </a>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, opacity: 0.8 }}>Device ID</label>
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          style={{
            width: 260,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
          }}
          placeholder="pi-001"
        />
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        {err ? <span style={{ color: "crimson", fontSize: 13 }}>{err}</span> : null}
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Appliance status */}
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Appliance</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 999,
                background: online ? "#16A34A" : "#DC2626",
              }}
            />
            <div style={{ fontSize: 16, fontWeight: 650 }}>{online ? "Online" : "Offline"}</div>
          </div>

          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
            Last seen: <b>{lastSeenUtc ? `${fmtAgo(lastSeenUtc)} (${lastSeenUtc})` : "—"}</b>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            Last web signal: <b>{lastSignal}</b>
          </div>

          {status?.appliance?.offline_after_s ? (
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
              Offline threshold: {Math.round(status.appliance.offline_after_s / 60)} minutes
            </div>
          ) : null}
        </div>

        {/* Apps */}
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Apps</div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div>
              <div style={{ fontWeight: 650 }}>WebRunner</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                URL checks on a schedule (interval + URL list)
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, color: webRunnerEnabled ? "#16A34A" : "#6B7280" }}>
                {webRunnerEnabled ? "ON" : "OFF"}
              </div>
              <div style={{ fontWeight: 700, color: webRunnerConfigured ? "#16A34A" : "#6B7280", fontSize: 12 }}>
                {webRunnerConfigured ? "Configured" : "Not configured"}
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", margin: "8px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div>
              <div style={{ fontWeight: 650 }}>RouteRunner</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Traceroute destinations + AI analysis</div>
            </div>
            <div style={{ opacity: 0.65, fontWeight: 700 }}>Coming soon</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div>
              <div style={{ fontWeight: 650 }}>PingRunner</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Ping destinations + AI analysis</div>
            </div>
            <div style={{ opacity: 0.65, fontWeight: 700 }}>Coming soon</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div>
              <div style={{ fontWeight: 650 }}>StorageRunner</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Local buffering + upload health</div>
            </div>
            <div style={{ opacity: 0.65, fontWeight: 700 }}>Coming soon</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div>
              <div style={{ fontWeight: 650 }}>NetLooker</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>“Who is talking” on the network</div>
            </div>
            <div style={{ opacity: 0.65, fontWeight: 700 }}>Coming soon</div>
          </div>
        </div>
      </div>

      {/* WebRunner config summary */}
      <div style={{ marginTop: 14, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>WebRunner Config Summary</div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", opacity: 0.85, fontSize: 13 }}>
          <div>
            Enabled: <b>{status ? (webRunnerEnabled ? "Yes" : "No") : "—"}</b>
          </div>
          <div>
            Interval: <b>{status ? `${status.webrunner.interval_s}s` : "—"}</b>
          </div>
          <div>
            URLs: <b>{status ? status.webrunner.url_count : "—"}</b>
          </div>
        </div>

        {status?.webrunner?.urls_preview?.length ? (
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            URLs (preview): <b>{status.webrunner.urls_preview.join(", ")}</b>
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <a href="/dashboard" style={{ textDecoration: "none", fontWeight: 700 }}>
            Configure WebRunner →
          </a>
        </div>
      </div>
    </div>
  );
}

