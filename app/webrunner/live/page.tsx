"use client";

import React, { useEffect, useMemo, useState } from "react";

type LiveMeasurement = {
  id: string | number;
  device_id: string;
  ts_utc: string;
  url: string;
  http_ms: number | null;
  http_err: string | null;
  success: boolean;
};

type LiveResponse = {
  ok: boolean;
  device_id: string;
  window_minutes: number;
  limit: number;
  device: {
    device_id: string;
    tenant_id: string | null;
    claimed: boolean;
    claim_code_sha256: string | null;
    hostname: string | null;
    ip: string | null;
    mode: string | null;
    last_seen: string | null;
  } | null;
  measurements: LiveMeasurement[];
  fetched_at_utc: string;
};

type TimeseriesPoint = {
  ts_utc: string;
  avg_latency_ms: number | null;
  samples: number;
  ok_samples: number;
  fail_samples: number;
};

type TimeseriesResponse = {
  ok: boolean;
  device_id: string;
  window_minutes: number;
  bucket_seconds: number;
  url: string | null;
  points: TimeseriesPoint[];
  fetched_at_utc: string;
};

function isoToLocal(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WebRunnerLivePage() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [windowMinutes, setWindowMinutes] = useState(60);

  const [live, setLive] = useState<LiveResponse | null>(null);
  const [series, setSeries] = useState<TimeseriesResponse | null>(null);
  const [err, setErr] = useState<string>("");

  async function fetchAll() {
    setErr("");
    try {
      const liveUrl = `/api/webrunner/live?device_id=${encodeURIComponent(deviceId)}&window_minutes=${windowMinutes}&limit=100`;
      const tsUrl = `/api/webrunner/timeseries?device_id=${encodeURIComponent(deviceId)}&window_minutes=${windowMinutes}&bucket_seconds=60`;

      const [liveRes, tsRes] = await Promise.all([fetch(liveUrl), fetch(tsUrl)]);
      const liveJson = (await liveRes.json()) as LiveResponse;
      const tsJson = (await tsRes.json()) as TimeseriesResponse;

      if (!liveJson.ok) throw new Error(`live error: ${(liveJson as any).error || "unknown"}`);
      if (!tsJson.ok) throw new Error(`timeseries error: ${(tsJson as any).error || "unknown"}`);

      setLive(liveJson);
      setSeries(tsJson);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, windowMinutes]);

  const latestSeen = live?.device?.last_seen ? new Date(live.device.last_seen).getTime() : 0;
  const online = latestSeen ? Date.now() - latestSeen < 2 * 60 * 1000 : false;

  const lastBucket = useMemo(() => {
    const pts = series?.points || [];
    return pts.length ? pts[pts.length - 1] : null;
  }, [series]);

  return (
    <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>WebRunner Live</h1>
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Device
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8, minWidth: 220 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Window (min)
          <input
            type="number"
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(parseInt(e.target.value || "60", 10))}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8, width: 120 }}
          />
        </label>

        <button
          onClick={fetchAll}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #aaa",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #f3b", background: "#fff5f7" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Device</div>
          <div><b>ID:</b> {live?.device?.device_id || deviceId}</div>
          <div><b>Hostname:</b> {live?.device?.hostname || "-"}</div>
          <div><b>IP:</b> {live?.device?.ip || "-"}</div>
          <div><b>Last seen:</b> {isoToLocal(live?.device?.last_seen) || "-"}</div>
          <div>
            <b>Status:</b>{" "}
            <span style={{ fontWeight: 800 }}>
              {online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div><b>Claimed:</b> {String(live?.device?.claimed ?? false)}</div>
          <div><b>Mode:</b> {live?.device?.mode || "-"}</div>
        </div>

        <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Last bucket (avg)</div>
          <div><b>Bucket time:</b> {isoToLocal(lastBucket?.ts_utc || "") || "-"}</div>
          <div><b>Avg latency (ms):</b> {lastBucket?.avg_latency_ms ?? "-"}</div>
          <div><b>Samples:</b> {lastBucket?.samples ?? "-"}</div>
          <div><b>OK:</b> {lastBucket?.ok_samples ?? "-"}</div>
          <div><b>Fail:</b> {lastBucket?.fail_samples ?? "-"}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #ddd", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Latest measurements</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Time</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>URL</th>
                <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>ms</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Result</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {(live?.measurements || []).slice(0, 50).map((m) => (
                <tr key={String(m.id)}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" }}>
                    {isoToLocal(m.ts_utc)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{m.url}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3", textAlign: "right" }}>
                    {m.http_ms ?? "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3", fontWeight: 700 }}>
                    {m.success ? "OK" : "FAIL"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                    {m.http_err || ""}
                  </td>
                </tr>
              ))}
              {!live?.measurements?.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: 10, color: "#666" }}>No measurements in this window.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          fetched_at_utc: {live?.fetched_at_utc || "-"} | timeseries_fetched_at_utc: {series?.fetched_at_utc || "-"}
        </div>
      </div>
    </div>
  );
}
