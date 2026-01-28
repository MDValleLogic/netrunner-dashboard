"use client";

import React, { useMemo, useState } from "react";
import { loadDeviceConfig, saveDeviceConfig } from "@/lib/client/deviceConfigClient";

function nowIso() {
  return new Date().toISOString();
}

export default function Home() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [intervalS, setIntervalS] = useState(300);
  const [urlsText, setUrlsText] = useState("https://example.com\nhttps://google.com");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // metadata
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [lastSeenUtc, setLastSeenUtc] = useState<string | null>(null);

  const urls = useMemo(
    () => urlsText.split("\n").map((s) => s.trim()).filter(Boolean),
    [urlsText]
  );

  async function fetchLastSeen(id: string) {
    try {
      const r = await fetch(
        `/api/measurements/recent?device_id=${encodeURIComponent(id)}&limit=1`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => ({}));
      const ts = j?.rows?.[0]?.ts_utc ?? null;
      setLastSeenUtc(ts);
    } catch {
      setLastSeenUtc(null);
    }
  }

  async function onLoad() {
    setStatus(null);
    setLoading(true);
    try {
      const env = await loadDeviceConfig(deviceId);
      const cfg = env?.config ?? {};

      setIntervalS(cfg.interval_s ?? 300);
      setUrlsText((cfg.urls ?? []).join("\n"));

      setServerUpdatedAt(env.updated_at ?? null);
      setLastLoadedAt(nowIso());
      setStatus({ kind: "ok", msg: "Loaded device config." });

      // Also fetch “device last seen”
      await fetchLastSeen(deviceId);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message || "Failed to load config." });
      setLastSeenUtc(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    setStatus(null);

    if (!deviceId) return setStatus({ kind: "err", msg: "Missing device_id." });
    if (urls.length === 0) return setStatus({ kind: "err", msg: "Add at least one URL." });
    if (!Number.isFinite(intervalS) || intervalS < 30)
      return setStatus({ kind: "err", msg: "Interval too small. Use >= 30 seconds." });

    setSaving(true);
    try {
      const config = { interval_s: intervalS, urls };
      await saveDeviceConfig(deviceId, config);

      setLastSavedAt(nowIso());
      setStatus({ kind: "ok", msg: "Saved. Device will apply on next poll." });

      // Refresh DB updated_at + last seen for instant confidence
      const env = await loadDeviceConfig(deviceId);
      setServerUpdatedAt(env.updated_at ?? null);
      await fetchLastSeen(deviceId);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message || "Failed to save config." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">ValleLogic • WebRunner</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            WebRunner config control — load/save URLs and interval for a device.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Device ID</span>
              <input
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-black dark:focus:ring-zinc-700"
                placeholder="pi-001"
              />
            </label>

            <label className="flex w-full flex-col gap-2 md:w-56">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Interval (seconds)</span>
              <input
                type="number"
                min={30}
                value={intervalS}
                onChange={(e) => setIntervalS(Number(e.target.value))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-black dark:focus:ring-zinc-700"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={onLoad}
                disabled={loading || saving}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
              >
                {loading ? "Loading…" : "Load"}
              </button>

              <button
                onClick={onSave}
                disabled={loading || saving}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                status.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100"
                  : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-100"
              }`}
            >
              <span className="mr-2 font-bold">{status.kind === "ok" ? "✓" : "✕"}</span>
              {status.msg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div>Last loaded (local): {lastLoadedAt ? new Date(lastLoadedAt).toLocaleString() : "—"}</div>
            <div>Last saved (local): {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "—"}</div>
            <div>Updated in DB: {serverUpdatedAt ? new Date(serverUpdatedAt).toLocaleString() : "—"}</div>
            <div>Device last seen: {lastSeenUtc ? new Date(lastSeenUtc).toLocaleString() : "—"}</div>
          </div>

          <div className="mt-6">
            <label className="flex flex-col gap-2">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">URLs (one per line)</span>
              <textarea
                rows={12}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-black dark:focus:ring-zinc-700"
                placeholder={"https://example.com\nhttps://yourapp.com/health\nhttps://google.com"}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

