"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Point = {
  ts_utc: string;
  dns_ms: number;
  http_ms: number;
  http_err: string;
};

type TimeseriesResp = {
  ok: boolean;
  device_id: string;
  since_minutes: number;
  urls: string[];
  points: number;
  series: Record<string, Point[]>;
  error?: string;
  details?: any;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mergeSeries(series: Record<string, Point[]>, field: "dns_ms" | "http_ms") {
  const byTs = new Map<string, any>();

  for (const [url, pts] of Object.entries(series)) {
    for (const p of pts) {
      const key = p.ts_utc;
      if (!byTs.has(key)) byTs.set(key, { ts_utc: key });
      byTs.get(key)[url] = p[field];
    }
  }

  return Array.from(byTs.values()).sort(
    (a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime()
  );
}

export default function DashboardPage() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [sinceMinutes, setSinceMinutes] = useState(60);
  const [urlsText, setUrlsText] = useState(
    ["https://google.com", "https://cloudflare.com", "https://vallelogic.com"].join("\n")
  );

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimeseriesResp | null>(null);
  const [err, setErr] = useState<string>("");

  const urls = useMemo(() => {
    return urlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [urlsText]);

  const dnsChartData = useMemo(() => (data?.series ? mergeSeries(data.series, "dns_ms") : []), [data]);
  const httpChartData = useMemo(() => (data?.series ? mergeSeries(data.series, "http_ms") : []), [data]);

  async function load() {
    setErr("");
    setLoading(true);
    setData(null);

    try {
      const qp = new URLSearchParams();
      qp.set("device_id", deviceId);
      qp.set("since_minutes", String(sinceMinutes));
      for (const u of urls) qp.append("urls", u);

      const res = await fetch(`/api/measurements/timeseries?${qp.toString()}`);
      const json = (await res.json()) as TimeseriesResp;

      if (!json.ok) {
        setErr(json.error || "Request failed");
      } else {
        setData(json);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>NetRunner Dashboard</h1>
      <div style={{ color: "#666", marginBottom: 18 }}>WebRunner timeline (DNS + HTTP) — MVP</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
          maxWidth: 900,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Device ID</div>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Time Range</div>
          <select
            value={sinceMinutes}
            onChange={(e) => setSinceMinutes(Number(e.target.value))}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          >
            <option value={60}>Last 60 minutes</option>
            <option value={240}>Last 4 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>URLs (max 5, one per line)</div>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
          />
        </div>

        <div style={{ gridColumn: "1 / span 2", display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            {loading ? "Loading..." : "Load"}
          </button>

          {data?.points != null && (
            <div style={{ color: "#666", fontSize: 13 }}>
              Points in window: <b>{data.points}</b>
            </div>
          )}

          {err && <div style={{ color: "crimson", fontSize: 13 }}>{err}</div>}
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>DNS time (ms)</div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={dnsChartData}>
              <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={25} />
              <YAxis />
              <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleString()} />
              <Legend />
              {data?.urls?.map((u) => (
                <Line key={u} type="monotone" dataKey={u} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>HTTP time (ms)</div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={httpChartData}>
              <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={25} />
              <YAxis />
              <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleString()} />
              <Legend />
              {data?.urls?.map((u) => (
                <Line key={u} type="monotone" dataKey={u} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: 16, color: "#666", fontSize: 12 }}>
        Tip: open <code>/dashboard</code> on your Vercel site.
      </div>
    </div>
  );
}
