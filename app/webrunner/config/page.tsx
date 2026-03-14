"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

type Config = { urls: string[]; interval_seconds: number; updated_at?: string | null; };

const INTERVAL_OPTIONS = [
  { value: 60,   label: "Every 1 minute"   },
  { value: 300,  label: "Every 5 minutes"  },
  { value: 600,  label: "Every 10 minutes" },
  { value: 1800, label: "Every 30 minutes" },
  { value: 3600, label: "Every 1 hour"     },
];
const CHART_COLORS = ["#3b82f6","#22c55e","#f97316","#a78bfa","#ef4444"];

const selectStyle = {
  width: "100%", background: "#111827", border: "1px solid #374151", borderRadius: 6,
  color: "#e5e7eb", padding: "8px 10px", fontSize: 12, fontFamily: "monospace",
};

export default function WebRunnerConfigPage() {
  const [deviceId, setDeviceId]   = useState("");
  const [devices, setDevices]     = useState<{device_id: string; nr_serial?: string; nickname?: string}[]>([]);
  const [urls, setUrls]           = useState<string[]>([]);
  const [newUrl, setNewUrl]       = useState("");
  const [interval, setIntervalS]  = useState(300);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ type: "success"|"error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/devices/list")
      .then(r => r.json())
      .then(j => {
        if (j?.ok && Array.isArray(j.devices) && j.devices.length > 0) {
          setDevices(j.devices);
          setDeviceId(j.devices[0].device_id);
        }
      }).catch(() => {});
  }, []);

  useEffect(() => { if (deviceId) loadConfig(); }, [deviceId]); // eslint-disable-line

  async function loadConfig() {
    setLoading(true); setMsg(null);
    try {
      const r = await fetch(`/api/webrunner/config?device_id=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.config) {
        setUrls(j.config.urls ?? []);
        setIntervalS(j.config.interval_seconds ?? 300);
        setUpdatedAt(j.config.updated_at ?? null);
      }
    } catch (e: any) { setMsg({ type: "error", text: String(e?.message ?? e) }); }
    finally { setLoading(false); }
  }

  async function saveConfig() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/webrunner/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, urls, interval_seconds: interval }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg({ type: "error", text: j.error || "Save failed" }); }
      else {
        setUrls(j.config.urls ?? urls);
        setIntervalS(j.config.interval_seconds ?? interval);
        setUpdatedAt(j.config.updated_at ?? null);
        setMsg({ type: "success", text: `Saved ${j.config.urls?.length ?? 0} URL(s) · interval ${j.config.interval_seconds}s. Appliance picks up on next cycle.` });
      }
    } catch (e: any) { setMsg({ type: "error", text: String(e?.message ?? e) }); }
    finally { setSaving(false); }
  }

  function addUrl() {
    const u = newUrl.trim();
    if (!u) return;
    const full = u.startsWith("http") ? u : `https://${u}`;
    if (urls.includes(full) || urls.length >= 20) return;
    setUrls(prev => [...prev, full]); setNewUrl("");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Settings size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">WebRunner Config</h1>
            <p className="text-xs text-gray-500 font-mono">Manage URLs and test intervals for your NetRunner Appliance</p>
          </div>
        </div>
        {updatedAt && (
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
            Last saved {new Date(updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="max-w-3xl space-y-4">

        {/* Device + Interval */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Device Settings</span>
            {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>Loading…</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Device</div>
              <select value={deviceId} onChange={e => setDeviceId(e.target.value)} style={selectStyle}>
                {devices.length === 0
                  ? <option value="">No devices</option>
                  : devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial || d.device_id}</option>)
                }
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Test Interval</div>
              <select value={interval} onChange={e => setIntervalS(Number(e.target.value))} style={selectStyle}>
                {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, fontFamily: "monospace" }}>
                Appliance will run all URLs every {interval < 60 ? `${interval}s` : interval < 3600 ? `${interval/60}m` : `${interval/3600}h`}
              </div>
            </div>
          </div>
        </div>

        {/* URL management */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>URLs to Monitor</span>
            <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{urls.length} / 20 URLs</span>
          </div>

          {/* Add URL */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              type="text" placeholder="https://example.com or example.com"
              value={newUrl} onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addUrl()}
              style={{ flex: 1, background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "8px 10px", fontSize: 12, fontFamily: "monospace" }}
            />
            <button onClick={addUrl} disabled={urls.length >= 20} style={{
              background: "transparent", border: "1px solid #374151", borderRadius: 6,
              color: "#9ca3af", padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
            }}>+ Add</button>
          </div>

          {/* URL list */}
          {urls.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
              No URLs configured. Add URLs above — the NetRunner Appliance will start monitoring them on the next cycle.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {urls.map((u, i) => (
                <div key={u} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#111827", border: "1px solid #1f2937", borderRadius: 6, padding: "10px 14px",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontFamily: "monospace", color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u}>{u}</span>
                  <button onClick={() => setUrls(prev => prev.filter(x => x !== u))} style={{
                    background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4,
                    color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "2px 8px", fontFamily: "monospace",
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status message */}
        {msg && (
          <div style={{
            padding: "10px 16px", borderRadius: 8,
            background: msg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.type === "success" ? "#22c55e" : "#ef4444", fontSize: 13,
          }}>
            {msg.type === "success" ? "✓" : "⚠"} {msg.text}
          </div>
        )}

        {/* Save buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={saveConfig} disabled={saving || loading} style={{
            background: "#1d4ed8", border: "none", borderRadius: 6,
            color: "#fff", padding: "11px 28px", fontSize: 14, fontWeight: 600,
            cursor: saving || loading ? "not-allowed" : "pointer",
            opacity: saving || loading ? 0.6 : 1, fontFamily: "monospace",
          }}>
            {saving ? "Saving…" : "Save Config → Push to Appliance"}
          </button>
          <button onClick={loadConfig} disabled={loading || saving} style={{
            background: "transparent", border: "1px solid #374151", borderRadius: 6,
            color: "#9ca3af", padding: "11px 20px", fontSize: 13, cursor: "pointer", fontFamily: "monospace",
          }}>Reload</button>
        </div>

        {/* Info box */}
        <div style={{
          display: "flex", gap: 10, padding: "12px 16px", borderRadius: 8,
          background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
          color: "#93c5fd", fontSize: 12,
        }}>
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
    </div>
  );
}
