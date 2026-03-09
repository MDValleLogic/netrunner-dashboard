"use client";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
const INTERVAL_OPTIONS = [
  { value: 60,   label: "Every 1 minute"   },
  { value: 300,  label: "Every 5 minutes"  },
  { value: 600,  label: "Every 10 minutes" },
  { value: 1800, label: "Every 30 minutes" },
  { value: 3600, label: "Every 1 hour"     },
];
const PRESETS = [
  { label: "Google DNS",    value: "8.8.8.8",                    icon: "🔍" },
  { label: "Cloudflare DNS",value: "1.1.1.1",                    icon: "🛡️" },
  { label: "Netflix",       value: "www.netflix.com",             icon: "🎬" },
  { label: "YouTube",       value: "www.youtube.com",             icon: "▶️" },
  { label: "Microsoft 365", value: "outlook.office365.com",       icon: "💼" },
  { label: "OneDrive",      value: "onedrive.live.com",           icon: "☁️" },
  { label: "Zoom",          value: "zoom.us",                     icon: "📹" },
  { label: "Google Meet",   value: "meet.google.com",             icon: "📹" },
  { label: "Slack",         value: "slack.com",                   icon: "💬" },
  { label: "AWS East",      value: "ec2.us-east-1.amazonaws.com", icon: "☁️" },
  { label: "CNN",           value: "www.cnn.com",                 icon: "📰" },
  { label: "ESPN",          value: "www.espn.com",                icon: "🏈" },
];

export default function RouteRunnerConfig() {
  const [targets, setTargets]     = useState<string[]>(["8.8.8.8", "1.1.1.1"]);
  const [newTarget, setNewTarget] = useState("");
  const [interval, setIntervalS]  = useState(300);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState<{ type: "success"|"error"; text: string }|null>(null);

  useEffect(() => {
    fetch(`/api/routerunner/config?device_id=${DEVICE_ID}`)
      .then(r => r.json())
      .then(j => { if (j?.ok && j.config) { setTargets(j.config.targets || ["8.8.8.8", "1.1.1.1"]); setIntervalS(j.config.interval_seconds || 300); } })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/routerunner/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device_id: DEVICE_ID, targets, interval_seconds: interval }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      setMsg({ type: "success", text: "Config saved — appliance will pick up changes on next cycle" });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  function addTarget(val: string) { const v = val.trim(); if (!v || targets.includes(v)) return; setTargets([...targets, v]); setNewTarget(""); }
  const available = PRESETS.filter(p => !targets.includes(p.value));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Settings size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RouteRunner · Config</h1>
            <p className="text-xs text-gray-500 font-mono">Configure trace destinations and schedule</p>
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
          <div className="mb-4" style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Test Schedule</div>
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

        {/* Destinations */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Trace Destinations</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{targets.length} configured</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {targets.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, padding: "8px 0" }}>No destinations configured</div>}
            {targets.map(t => {
              const preset = PRESETS.find(p => p.value === t);
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#111827", border: "1px solid #1f2937" }}>
                  <span style={{ fontSize: 18 }}>{preset?.icon || "🎯"}</span>
                  <div style={{ flex: 1 }}>
                    {preset && <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{preset.label}</div>}
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#60a5fa" }}>{t}</div>
                  </div>
                  <button onClick={() => setTargets(targets.filter(x => x !== t))} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>✕</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Add custom IP or hostname…" value={newTarget} onChange={e => setNewTarget(e.target.value)} onKeyDown={e => e.key === "Enter" && addTarget(newTarget)}
              style={{ flex: 1, background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "8px 10px", fontSize: 12, fontFamily: "monospace" }} />
            <button onClick={() => addTarget(newTarget)} style={{ background: "transparent", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>+ Add</button>
          </div>
        </div>

        {/* Quick add presets */}
        {available.length > 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="mb-4" style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Quick Add — Common Destinations</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {available.map(preset => (
                <button key={preset.value} onClick={() => addTarget(preset.value)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 8, cursor: "pointer", background: "#111827", border: "1px solid #1f2937",
                  textAlign: "left", transition: "border-color 0.15s",
                }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = "#3b82f6")}
                  onMouseOut={e => (e.currentTarget.style.borderColor = "#1f2937")}>
                  <span style={{ fontSize: 20 }}>{preset.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{preset.label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>{preset.value}</div>
                  </div>
                  <span style={{ marginLeft: "auto", color: "#60a5fa", fontSize: 16 }}>+</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
