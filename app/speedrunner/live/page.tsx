"use client";
import { useEffect, useState } from "react";
import { useDevice } from "@/lib/deviceContext";
import { Zap } from "lucide-react";

type Result = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; server_name: string|null; server_city: string|null; result_url: string|null; };
const REGION_META: Record<string, string> = { "Northeast US": "🗽", "Southeast US": "🌴", "Midwest US": "🌽", "West Coast US": "🌉", "Europe": "🏰", "Asia Pacific": "🗼" };

function speedColor(mbps: number|null, type: "down"|"up") {
  if (!mbps) return "#6b7280";
  const t = type === "down" ? { g: 400, ok: 100, w: 25 } : { g: 100, ok: 20, w: 5 };
  return mbps >= t.g ? "#22c55e" : mbps >= t.ok ? "#60a5fa" : mbps >= t.w ? "#f59e0b" : "#ef4444";
}
function pingColor(ms: number|null) {
  if (!ms) return "#6b7280";
  return ms < 20 ? "#22c55e" : ms < 60 ? "#60a5fa" : ms < 120 ? "#f59e0b" : "#ef4444";
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }

export default function SpeedRunnerLive() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  async function fetchData() {
    try {
      const j = await fetch(`/api/speedrunner/results?device_id=${selectedDeviceId || ""}&limit=12`).then(r => r.json());
      if (j.ok) setResults(j.history || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    const p = setInterval(fetchData, 30_000);
    const c = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(p); clearInterval(c); };
  }, []);

  const nextRefresh = Math.max(0, 30 - (tick % 30));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Zap size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">SpeedRunner · Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">Most recent speed test results</p>
          </div>
        </div>
        <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <span style={ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }>refresh in {nextRefresh}s</span>
      </div>

      <div className="max-w-5xl">
        {loading ? (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-8 text-center" style={{ color: "#6b7280" }}>Loading…</div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-12 text-center">
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>No speed tests yet</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {results.slice(0, 6).map(r => (
              <div key={r.id} className="rounded-lg border border-gray-700/60 bg-gray-900/60">
                <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
                  <span>
                    <span style={{ fontSize: 14 }}>{REGION_META[r.region] || "🌐"}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#e5e7eb", marginLeft: 6 }}>{r.region}</span>
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{fmtTime(r.ts_utc)}</span>
                </div>
                <div style={{ padding: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>↓ Download</div>
                      <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: speedColor(r.download_mbps, "down") }}>
                        {r.download_mbps != null ? r.download_mbps.toFixed(0) : "—"}
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>Mbps</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>↑ Upload</div>
                      <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: speedColor(r.upload_mbps, "up") }}>
                        {r.upload_mbps != null ? r.upload_mbps.toFixed(0) : "—"}
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>Mbps</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Ping</div>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: pingColor(r.ping_ms) }}>
                        {r.ping_ms != null ? `${r.ping_ms.toFixed(1)}ms` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Jitter</div>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: "#9ca3af" }}>
                        {r.jitter_ms != null ? `±${r.jitter_ms.toFixed(1)}ms` : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", borderTop: "1px solid #1f2937", paddingTop: 8 }}>
                    {r.region_city}{r.server_name ? ` · ${r.server_name}` : ""}
                    {r.result_url && (
                      <a href={r.result_url} target="_blank" rel="noopener" style={{ marginLeft: 8, color: "#60a5fa", fontSize: 10 }}>view result ↗</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
