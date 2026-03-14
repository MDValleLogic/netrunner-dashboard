"use client";
import { useDevice } from "@/lib/deviceContext";

import { useEffect, useState } from "react";
import { Settings, Save, Wifi, Radio } from "lucide-react";

interface RFConfig {
  scan_enabled: boolean;
  scan_interval: number;
  active_enabled: boolean;
  active_ssid: string;
  active_psk: string;
  active_interval: number;
}

const INTERVAL_OPTIONS = [
  { label: "30 seconds", value: 30 },
  { label: "60 seconds", value: 60 },
  { label: "2 minutes",  value: 120 },
  { label: "5 minutes",  value: 300 },
];

const ACTIVE_INTERVAL_OPTIONS = [
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour",     value: 3600 },
  { label: "2 hours",    value: 7200 },
];

export default function RFRunnerConfigPage() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [config, setConfig] = useState<RFConfig>({
    scan_enabled: true,
    scan_interval: 60,
    active_enabled: false,
    active_ssid: "",
    active_psk: "",
    active_interval: 1800,
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPsk, setShowPsk]   = useState(false);

  useEffect(() => {
    fetch(`/api/rfrunner/config${selectedDeviceId ? "?device_id="+selectedDeviceId : ""}`)
      .then(r => r.json())
      .then(j => { if (j.config) setConfig(j.config); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/rfrunner/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        <div className="max-w-2xl space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-800/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Settings size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RF Config</h1>
            <p className="text-xs text-gray-500 font-mono">Scanner settings</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-mono">
            ⚠ {error}
          </div>
        )}

        {/* Scan Mode */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <Radio size={16} className="text-blue-400" />
              <div>
                <div className="text-sm font-semibold text-gray-100">Scan Mode</div>
                <div className="text-xs text-gray-500 font-mono">Passive RF environment scanning</div>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={() => setConfig(c => ({ ...c, scan_enabled: !c.scan_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.scan_enabled ? "bg-blue-600" : "bg-gray-700"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.scan_enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="px-5 py-4">
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Scan Interval</label>
            <div className="flex gap-2">
              {INTERVAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(c => ({ ...c, scan_interval: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    config.scan_interval === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active Mode */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <Wifi size={16} className="text-purple-400" />
              <div>
                <div className="text-sm font-semibold text-gray-100">Active Mode</div>
                <div className="text-xs text-gray-500 font-mono">Associate to WiFi and run Runner Suite</div>
              </div>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, active_enabled: !c.active_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.active_enabled ? "bg-purple-600" : "bg-gray-700"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.active_enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* SSID */}
            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Target SSID</label>
              <input
                type="text"
                value={config.active_ssid}
                onChange={e => setConfig(c => ({ ...c, active_ssid: e.target.value }))}
                placeholder="e.g. forman-psk"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* PSK */}
            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">WiFi Password (PSK)</label>
              <div className="relative">
                <input
                  type={showPsk ? "text" : "password"}
                  value={config.active_psk}
                  onChange={e => setConfig(c => ({ ...c, active_psk: e.target.value }))}
                  placeholder="WiFi password"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors pr-16"
                />
                <button
                  onClick={() => setShowPsk(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPsk ? "hide" : "show"}
                </button>
              </div>
            </div>

            {/* Active interval */}
            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Test Interval</label>
              <div className="flex gap-2">
                {ACTIVE_INTERVAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig(c => ({ ...c, active_interval: opt.value }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      config.active_interval === opt.value
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Coming soon notice */}
        <div className="px-4 py-3 rounded-lg bg-gray-900/40 border border-gray-800 text-xs font-mono text-gray-600">
          ℹ Active Mode is live. Run wifitest.py manually on the Pi, or scheduled execution via systemd timer is coming in a future update.
        </div>

      </div>
    </div>
  );
}
