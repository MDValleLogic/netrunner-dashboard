"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Point = {
  url: string;
  ts_utc: string;
  v: number;
};

export default function WebRunnerLive() {
  const [metric, setMetric] = useState<"http" | "dns">("http");
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/webrunner/timeseries?device_id=pi-001&metric=${metric}&window_minutes=60&bucket_seconds=30`
    );
    const json = await res.json();
    setData(json.points || []);
    setLoading(false);
  }

  // Poll every 10s
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [metric]);

  // Group by timestamp for recharts
  const chartData = useMemo(() => {
    const byTs: Record<string, any> = {};
    for (const p of data) {
      const ts = new Date(p.ts_utc).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      byTs[ts] ??= { ts };
      byTs[ts][p.url] = p.v;
    }
    return Object.values(byTs);
  }, [data]);

  const urls = useMemo(() => {
    const s = new Set<string>();
    data.forEach(d => s.add(d.url));
    return Array.from(s);
  }, [data]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>WebRunner Live</h1>
      <div style={{ marginTop: 6, opacity: 0.7 }}>
        Real-time experience truth (auto-refreshing)
      </div>

      {/* Controls */}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => setMetric("http")}
          style={btn(metric === "http")}
        >
          HTTP
        </button>
        <button
          onClick={() => setMetric("dns")}
          style={btn(metric === "dns")}
        >
          DNS
        </button>
      </div>

      {/* Graph */}
      <div
        style={{
          marginTop: 24,
          height: 420,
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          background: "white",
        }}
      >
        {loading ? (
          <div style={{ opacity: 0.6 }}>Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ts" />
              <YAxis
                label={{
                  value: metric === "http" ? "HTTP ms" : "DNS ms",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Legend />
              {urls.map((u, i) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
];

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: active ? "#111" : "white",
    color: active ? "white" : "#111",
    cursor: "pointer",
  };
}
