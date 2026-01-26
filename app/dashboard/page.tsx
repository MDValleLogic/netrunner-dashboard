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

const COLORS = ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#ef4444"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Convert per-url series into chart rows: { ts_utc, "<url1>": value, "<url2>": value, ... }
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

function normalizeUrl(u: string) {
  return u.trim();
}

export default function DashboardPage() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [sinceMinutes, setSinceMinutes] = useState(60);

  // Source of truth for urls (still stored as text so it’s easy + durable)
  const [urlsText, setUrlsText] = useState(
    ["https://google.com", "https://cloudflare.com", "https://vallelogic.com"].join("\n")
  );

  // Add-URL input
  const [newUrl, setNewUrl] = useState("");

  // Data + UI state
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimeseriesResp | null>(null);
  const [err, setErr] = useState<string>("");

  // Parsed URL list (max 5)
  const urls = useMemo(() => {
    return urlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [urlsText]);

  const dnsChartData = useMemo(
    () => (data?.series ? mergeSeries(data.series, "dns_ms") : []),
    [data]
  );
  const httpChartData = useMemo(
    () => (data?.series ? mergeSeries(data.series, "http_ms") : []),
    [data]
  );

  function setUrlsList(next: string[]) {
    const cleaned = next.map(normalizeUrl).filter(Boolean);
    const uniq = Array.from(new Set(cleaned)).slice(0, 5);
    setUrlsText(uniq.join("\n"));
  }

  function addUrl() {
    const u = normalizeUrl(newUrl);
    if (!u) return;

    const current = urlsText
      .split("\n")
      .map(normalizeUrl)
      .filter(Boolean);

    if (current.length >= 5) {
      alert("Max 5 URLs for MVP");
      return;
    }

    if (current.includes(u)) {
      setNewUrl("");
      return;
    }

    setUrlsList([...current, u]);
    setNewUrl("");
  }

  function deleteUrl(u: string) {
    const current = urlsText
      .split("\n")
      .map(normalizeUrl)
      .filter(Boolean);

    setUrlsList(current.filter((x) => x !== u));
  }

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
    <div
      style={{
        padding: 24,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>NetRunner Dashboard</h1>
      <div style={{ color: "#666", marginBottom: 18 }}>
        WebRunner timeline (DNS + HTTP) — MVP
      </div>

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
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Device ID
          </div>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Time Range
          </div>
          <select
            value={sinceMinutes}
            onChange={(e) => setSinceMinutes(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          >
            <option value={60}>Last 60 minutes</option>
            <option value={240}>Last 4 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
        </div>

        {/* URL Management */}
        <div style={{ gridColumn: "1 / span 2" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            URLs (max 5)
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={{
                flex: 1,
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 10,
              }}
            />
            <button
              onClick={addUrl}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
            {urls.length === 0 ? (
              <div style={{ color: "#666", fontSize: 13 }}>No URLs yet.</div>
            ) : (
              urls.map((u) => (
                <div
                  key={u}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 6px",
                    borderBottom: "1px solid #f3f3f3",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                    title={u}
                  >
                    {u}
                  </div>
                  <button
                    onClick={() => deleteUrl(u)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Keep textarea as editable “source of truth” (helps debugging and quick bulk edits) */}
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
              marginTop: 10,
            }}
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
              {data?.urls?.map((u, i) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  dot={false}
                  strokeWidth={2}
                  stroke={COLORS[i % COLORS.length]}
                />
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
              {data?.urls?.map((u, i) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  dot={false}
                  strokeWidth={2}
                  stroke={COLORS[i % COLORS.length]}
                />
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
