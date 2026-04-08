"use client";
import { useEffect, useState } from "react";

interface TableSize { table_name: string; pretty_size: string; bytes: number; row_count: number; }
interface DeviceStat { device_id: string; nickname: string; nr_serial: string; measurements_rows: number; speed_rows: number; rf_rows: number; rf_hourly_rows: number; route_rows: number; hop_rows: number; results_rows: number; heartbeat_rows: number; }
interface SizeData { total: { total_pretty: string; total_bytes: number }; tables: TableSize[]; devices: DeviceStat[]; }

function Bar({ pct, color = "#3b82f6" }: { pct: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const DATA_TABLES = ["measurements", "speed_results", "rf_scans", "rf_scans_hourly", "route_traces", "route_hops", "results", "device_heartbeats"];

export default function StoragePage() {
  const [data, setData] = useState<SizeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/devices/storage")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxBytes = data ? Math.max(...data.tables.map(t => t.bytes), 1) : 1;
  const dataTableBytes = data ? data.tables.filter(t => DATA_TABLES.includes(t.table_name)).reduce((a, b) => a + Number(b.bytes), 0) : 0;

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "20px 24px", marginBottom: 16 };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase" as any, marginBottom: 10 };

  return (
    <div style={{ padding: "28px 32px", fontFamily: "monospace", color: "#e5e7eb", minHeight: "100vh", background: "#0d1117" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.02em" }}>Storage & Data</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Database usage across all devices and runners</div>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Loading storage data…</div>
        ) : !data ? (
          <div style={{ color: "#ef4444", fontSize: 13 }}>Failed to load storage data.</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total DB Size", value: data.total.total_pretty, sub: "all tables" },
                { label: "Runner Data Size", value: dataTableBytes > 1_000_000
                    ? `${(dataTableBytes / 1_000_000).toFixed(1)} MB`
                    : `${(dataTableBytes / 1_000).toFixed(0)} KB`, sub: "measurements + results" },
                { label: "Total Rows", value: fmt(data.tables.reduce((a, b) => a + Number(b.row_count), 0)), sub: "across all tables" },
              ].map(s => (
                <div key={s.label} style={card}>
                  <div style={lbl}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f3f4f6" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Table breakdown */}
            <div style={card}>
              <div style={lbl}>Table Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.tables.map(t => (
                  <div key={t.table_name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 160, fontSize: 12, color: DATA_TABLES.includes(t.table_name) ? "#e5e7eb" : "#6b7280", flexShrink: 0 }}>{t.table_name}</div>
                    <Bar pct={(t.bytes / maxBytes) * 100} color={DATA_TABLES.includes(t.table_name) ? "#3b82f6" : "#374151"} />
                    <div style={{ width: 70, textAlign: "right", fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{t.pretty_size}</div>
                    <div style={{ width: 60, textAlign: "right", fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{fmt(Number(t.row_count))} rows</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-device breakdown */}
            <div style={card}>
              <div style={lbl}>Per-Device Row Counts</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {data.devices.map(d => {
                  const total = d.measurements_rows + d.speed_rows + d.rf_rows + d.rf_hourly_rows + d.route_rows + d.hop_rows + d.results_rows + d.heartbeat_rows;
                  return (
                    <div key={d.device_id}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#f3f4f6" }}>{d.nickname || d.nr_serial}</span>
                          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>{d.nr_serial}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{fmt(total)} total rows</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {[
                          { label: "WebRunner", rows: d.measurements_rows, color: "#3b82f6" },
                          { label: "SpeedRunner", rows: d.speed_rows, color: "#f97316" },
                          { label: "RFRunner", rows: d.rf_rows + d.rf_hourly_rows, color: "#10b981" },
                          { label: "RouteRunner", rows: d.route_rows + d.hop_rows, color: "#a78bfa" },
                          { label: "Results", rows: d.results_rows, color: "#6b7280" },
                          { label: "Heartbeats", rows: d.heartbeat_rows, color: "#6b7280" },
                        ].map(r => (
                          <div key={r.label} style={{ padding: "8px 10px", background: "#0d1117", borderRadius: 6, border: "1px solid #1f2937" }}>
                            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{r.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: r.rows > 0 ? r.color : "#374151" }}>{fmt(r.rows)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div style={{ ...card, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600, marginBottom: 6 }}>ℹ Data Retention</div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
                Currently there is no automatic data cap or retention policy. Data grows indefinitely. To free space, use the <strong>Wipe Device Data</strong> button in Device Setup. Automatic retention policies (e.g. 90-day rolling window) are planned for a future session.
              </div>
            </div>
          </>
        )}
      </div>
  );
}
