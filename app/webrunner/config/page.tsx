"use client";

import { useEffect, useState } from "react";

type Config = {
  urls: string[];
  interval_seconds: number;
  updated_at?: string | null;
};

const INTERVAL_OPTIONS = [
  { value: 60,   label: "Every 1 minute"  },
  { value: 300,  label: "Every 5 minutes" },
  { value: 600,  label: "Every 10 minutes"},
  { value: 1800, label: "Every 30 minutes"},
  { value: 3600, label: "Every 1 hour"    },
];

const CHART_COLORS = ["#2563eb","#16a34a","#ea580c","#7c3aed","#dc2626"];

export default function ConfigPage() {
  const [deviceId, setDeviceId]   = useState("pi-001");
  const [devices, setDevices]     = useState<string[]>([]);
  const [urls, setUrls]           = useState<string[]>([]);
  const [newUrl, setNewUrl]       = useState("");
  const [interval, setIntervalS]  = useState(300);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ type: "success"|"error"; text: string } | null>(null);

  // Load devices
  useEffect(() => {
    fetch("/api/devices")
      .then(r => r.json())
      .then(j => {
        if (j?.ok && Array.isArray(j.devices) && j.devices.length > 0) {
          const ids = j.devices.map((d: any) => d.device_id);
          setDevices(ids);
          setDeviceId(ids[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Load config when device changes
  useEffect(() => {
    if (!deviceId) return;
    loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function loadConfig() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/webrunner/config?device_id=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.config) {
        setUrls(j.config.urls ?? []);
        setIntervalS(j.config.interval_seconds ?? 300);
        setUpdatedAt(j.config.updated_at ?? null);
      }
    } catch (e: any) {
      setMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/webrunner/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, urls, interval_seconds: interval }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ type: "error", text: j.error || "Save failed" });
      } else {
        setUrls(j.config.urls ?? urls);
        setIntervalS(j.config.interval_seconds ?? interval);
        setUpdatedAt(j.config.updated_at ?? null);
        setMsg({ type: "success", text: `Saved ${j.config.urls?.length ?? 0} URL(s) · interval ${j.config.interval_seconds}s. Appliance will pick up on next cycle.` });
      }
    } catch (e: any) {
      setMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setSaving(false);
    }
  }

  function addUrl() {
    const u = newUrl.trim();
    if (!u) return;
    const full = u.startsWith("http") ? u : `https://${u}`;
    if (urls.includes(full) || urls.length >= 20) return;
    setUrls(prev => [...prev, full]);
    setNewUrl("");
  }

  function removeUrl(u: string) {
    setUrls(prev => prev.filter(x => x !== u));
  }

  return (
    <>
      {/* Topbar */}
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">WebRunner Config</div>
          <div className="vl-topbar-sub">Manage URLs and test intervals for your NetRunner Appliance</div>
        </div>
        <div className="vl-topbar-spacer" />
        {updatedAt && (
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Last saved {new Date(updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>

        {/* Device + Interval */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Device Settings</span>
            {loading && <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading…</span>}
          </div>
          <div className="vl-card-body">
            <div className="vl-grid-2">
              <div>
                <label className="vl-label">Device</label>
                <select className="vl-select" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                  {devices.length === 0
                    ? <option value="pi-001">pi-001</option>
                    : devices.map(d => <option key={d} value={d}>{d}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="vl-label">Test Interval</label>
                <select className="vl-select" value={interval} onChange={e => setIntervalS(Number(e.target.value))}>
                  {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                  Appliance will run all URLs every {interval < 60 ? `${interval}s` : interval < 3600 ? `${interval/60}m` : `${interval/3600}h`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* URL management */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>URLs to Monitor</span>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{urls.length} / 20 URLs</span>
          </div>
          <div className="vl-card-body">

            {/* Add URL */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                className="vl-input"
                type="text"
                placeholder="https://example.com or example.com"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addUrl()}
              />
              <button className="vl-btn vl-btn-ghost" onClick={addUrl} disabled={urls.length >= 20}>
                + Add
              </button>
            </div>

            {/* URL list */}
            {urls.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                No URLs configured. Add URLs above — the NetRunner Appliance will start monitoring them on the next cycle.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {urls.map((u, i) => (
                  <div key={u} className="vl-url-tag" style={{ padding: "10px 14px" }}>
                    <div className="vl-url-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="vl-url-label" title={u} style={{ fontSize: 13 }}>{u}</span>
                    <button
                      className="vl-btn vl-btn-danger vl-btn-sm"
                      onClick={() => removeUrl(u)}
                      style={{ flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alert */}
        {msg && (
          <div className={`vl-alert vl-alert-${msg.type === "success" ? "success" : "error"}`}>
            {msg.type === "success" ? "✓" : "⚠"} {msg.text}
          </div>
        )}

        {/* Save */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="vl-btn vl-btn-primary"
            onClick={saveConfig}
            disabled={saving || loading}
            style={{ padding: "11px 28px", fontSize: 14 }}
          >
            {saving ? "Saving…" : "Save Config → Push to Appliance"}
          </button>
          <button
            className="vl-btn vl-btn-ghost"
            onClick={loadConfig}
            disabled={loading || saving}
          >
            Reload
          </button>
        </div>

        {/* Info box */}
        <div className="vl-alert vl-alert-info">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>
            Config is stored in the cloud. Your NetRunner Appliance fetches config automatically on each boot and every test cycle.
            Changes take effect within one cycle (~{interval}s).
          </span>
        </div>

      </div>
    </>
  );
}
