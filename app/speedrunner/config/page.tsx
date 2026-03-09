"use client";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
const INTERVAL_OPTIONS = [
  { value: 3600,  label: "Every 1 hour"   },
  { value: 10800, label: "Every 3 hours"  },
  { value: 21600, label: "Every 6 hours"  },
  { value: 43200, label: "Every 12 hours" },
  { value: 86400, label: "Every 24 hours" },
];
const ALL_REGIONS = [
  { region: "Northeast US",  city: "New York, NY",    server_id: "1786",  icon: "🗽" },
  { region: "Southeast US",  city: "Atlanta, GA",     server_id: "10039", icon: "🌴" },
  { region: "Midwest US",    city: "Chicago, IL",     server_id: "1776",  icon: "🌽" },
  { region: "West Coast US", city: "Los Angeles, CA", server_id: "5114",  icon: "🌉" },
  { region: "Europe",        city: "London, UK",      server_id: "13873", icon: "🏰" },
  { region: "Asia Pacific",  city: "Tokyo, Japan",    server_id: "15047", icon: "🗼" },
];

export default function SpeedRunnerConfig() {
  const [interval, setIntervalS]     = useState(3600);
  const [enabledRegions, setEnabled] = useState<string[]>(ALL_REGIONS.map(r => r.region));
  const [saving, setSaving]          = useState(false);
  const [msg, setMsg]                = useState<{ type: "success"|"error"; text: string }|null>(null);

  useEffect(() => {
    fetch(`/api/speedrunner/config?device_id=${DEVICE_ID}`).then(r => r.json())
      .then(j => { if (j?.ok && j.config) { setIntervalS(j.config.interval_seconds || 3600); setEnabled(j.config.regions || ALL_REGIONS.map(r => r.region)); } })
      .catch(() => {});
  }, []);

  function toggleRegion(r: string) { setEnabled(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/speedrunner/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device_id: DEVICE_ID, interval_seconds: interval, regions: enabledRegions }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      setMsg({ type: "success", text: "Config saved — appliance will pick up changes on next cycle" });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
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
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">SpeedRunner · Config</h1>
            <p className="text-xs text-gray-500 font-mono">Configure test schedule and regions</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{
          background: "#1d4ed8", border: "none", borderRadius: 6, color: "#fff",
          padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.6 : 1, fontFamily: "monospace",
        }}>{saving ? "Saving…" : "Save Config → Push to Appliance"}</button>
      </div>

      <div className="max-w-3xl space-y-4">
        {msg && (
          <div style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, background: msg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: msg.type === "success" ? "#22c55e" : "#ef4444" }}>
            {msg.type === "success" ? "✓" : "⚠"} {msg.text}
          </div>
        )}

        {/* Schedule */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="mb-3" style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Test Schedule</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>⚠ Speed tests consume bandwidth. Hourly is recommended for most users.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {INTERVAL_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setIntervalS(opt.value)} style={{
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: interval === opt.value ? "2px solid #3b82f6" : "1px solid #374151",
                background: interval === opt.value ? "rgba(59,130,246,0.1)" : "#111827",
                color: interval === opt.value ? "#60a5fa" : "#9ca3af",
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Test Regions</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{enabledRegions.length} of {ALL_REGIONS.length} enabled</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {ALL_REGIONS.map(r => {
              const enabled = enabledRegions.includes(r.region);
              return (
                <button key={r.region} onClick={() => toggleRegion(r.region)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                  border: enabled ? "2px solid #3b82f6" : "1px solid #374151",
                  background: enabled ? "rgba(59,130,246,0.08)" : "#111827",
                  textAlign: "left", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 24 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? "#60a5fa" : "#e5e7eb" }}>{r.region}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{r.city} · Server #{r.server_id}</div>
                  </div>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: `2px solid ${enabled ? "#3b82f6" : "#374151"}`,
                    background: enabled ? "#3b82f6" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {enabled && <span style={{ fontSize: 8, color: "white", fontWeight: 900 }}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
