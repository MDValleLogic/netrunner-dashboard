"use client";
import { useEffect, useState } from "react";
import { useDevice } from "@/lib/deviceContext";
import { Clock } from "lucide-react";

type Trace = { id: number; ts_utc: string; target: string; dest_ip: string; hop_count: number; total_hops: number; };
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }

const sel = { background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" };

export default function RouteRunnerHistory() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [traces, setTraces]   = useState<Trace[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget]   = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchHistory(t?: string) {
    setLoading(true);
    try {
      const tParam = t !== undefined ? t : target;
      const did = selectedDeviceId ? `&device_id=${selectedDeviceId}` : "";
      const url = `/api/routerunner/results?limit=50${tParam ? "&target=" + encodeURIComponent(tParam) : ""}${did}`;
      const j = await fetch(url).then(r => r.json());
      if (!j.traces) return;
      setTraces(j.traces || []);
      if (j.targets?.length) setTargets(j.targets);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchHistory(); }, []); // eslint-disable-line
  useEffect(() => { fetchHistory(target); }, [target]); // eslint-disable-line
  useEffect(() => { fetchHistory(); }, [selectedDeviceId]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RouteRunner · History</h1>
            <p className="text-xs text-gray-500 font-mono">All recorded traces</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ ...sel, maxWidth: 200 }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...sel, maxWidth: 240 }}>
            <option value="">All targets</option>
            {targets.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => fetchHistory(target)} style={{
            background: "transparent", border: "1px solid #374151", borderRadius: 6,
            color: "#9ca3af", padding: "6px 14px", fontSize: 13, cursor: "pointer",
          }}>↻ Refresh</button>
        </div>
      </div>

      <div className="max-w-5xl">
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Trace History</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{traces.length} traces</span>
          </div>
          {loading ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>Loading…</div>
          ) : traces.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>No traces yet</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1f2937" }}>
                    {["Time", "Target", "Destination IP", "Total Hops", "Responding", "Timeouts"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traces.map(t => {
                    const timeouts = t.total_hops - t.hop_count;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #111827" }}>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{fmtTime(t.ts_utc)}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#60a5fa" }}>{t.target}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{t.dest_ip || "—"}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#e5e7eb", textAlign: "right" }}>{t.total_hops}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#22c55e", textAlign: "right" }}>{t.hop_count}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: timeouts > 0 ? "#f59e0b" : "#6b7280", textAlign: "right" }}>{timeouts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
