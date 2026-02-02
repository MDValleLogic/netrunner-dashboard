"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

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

type DeviceRow = {
  device_id: string;
  updated_at?: string;
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

function useBoxSize(defaultH = 280) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 900, h: defaultH });

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({
        w: Math.max(1, Math.floor(r.width)),
        h: Math.max(1, Math.floor(r.height)),
      });
    };

    // Initial
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return { ref, w: size.w, h: size.h };
}

export default function DashboardPage() {
  // Tenant devices dropdown
  const [deviceId, setDeviceId] = useState<string>("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);

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

  // Chart containers
  const dnsBox = useBoxSize(280);
  const httpBox = useBoxSize(280);

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

  // Load tenant-scoped devices once
  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      try {
        const res = await fetch("/api/devices");
        const json = await res.json();

        if (cancelled) return;

        if (json?.ok && Array.isArray(json.devices)) {
          setDevices(json.devices);

          // Default to newest device if none selected yet
          if (!deviceId && json.devices.length > 0) {
            setDeviceId(json.devices[0].device_id);
          }
        }
      } catch {
        // ignore for MVP
      }
    }

    loadDevices();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!deviceId) {
        setErr("Select a device");
        return;
      }

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

  const chartW1 = Math.max(1, dnsBox.w - 20); // subtract padding
  const chartH1 = Math.max(1, dnsBox.h - 20);
  const chartW2 = Math.max(1, httpBox.w - 20);
  const chartH2 = Math.max(1, httpBox.h - 20);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
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
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Device</div>

          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "white",
            }}
          >
            {devices.length === 0 ? (
              <option value="">No devices</option>
            ) : (
              devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Time Range</div>
          <select
            value={sinceMinutes}
            onChange={(e) => setSinceMinutes(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "white",
            }}
          >
            <option value={60}>Last 60 minutes</option>
            <option value={240}>Last 4 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
        </div>

        {/* URL Management */}
        <div style={{ gridColumn: "1 / span 2" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>URLs (max 5)</div>

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

          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
            }}
          >
            {urls.map((u) => (
              <div
                key={u}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 6px",
                  borderBottom: "1px solid #f3f3f3",
                }}
              >
                <div style={{ fontSize: 13 }}>{u}</div>
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
            ))}
          </div>

          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
              fontSize: 12,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={load}
          disabled={loading || urls.length === 0 || !deviceId}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
            opacity: loading || urls.length === 0 || !deviceId ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : "Load"}
        </button>

        <div style={{ color: "#666", fontSize: 12 }}>
          Points in window: {data?.points ?? 0}
        </div>

        {err ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div> : null}
      </div>

      {/* Charts */}
      <div style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>DNS time (ms)</div>

          <div
            ref={dnsBox.ref}
            style={{
              height: 280,
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 10,
              overflow: "hidden",
            }}
          >
            <LineChart width={chartW1} height={chartH1} data={dnsChartData}>
              <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={24} />
              <YAxis />
              <Tooltip labelFormatter={(v) => fmtTime(String(v))} />
              <Legend />
              {urls.map((u, idx) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  dot={false}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>HTTP time (ms)</div>

          <div
            ref={httpBox.ref}
            style={{
              height: 280,
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 10,
              overflow: "hidden",
            }}
          >
            <LineChart width={chartW2} height={chartH2} data={httpChartData}>
              <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={24} />
              <YAxis />
              <Tooltip labelFormatter={(v) => fmtTime(String(v))} />
              <Legend />
              {urls.map((u, idx) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  dot={false}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>
        </div>
      </div>
    </div>
  );
}

