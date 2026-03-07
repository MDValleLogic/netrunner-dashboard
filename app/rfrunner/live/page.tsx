"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Wifi, RefreshCw, Radio } from "lucide-react";

interface RawNetwork {
  ssid: string;
  bssid: string;
  signal: number;
  channel: number | null;
  band: string | null;
  security: string | null;
  frequency: number | null;
}

interface ScanResult {
  device_id: string;
  scanned_at: string;
  networks: RawNetwork[];
}

interface BSSIDEntry {
  bssid: string;
  signal: number;
  channel: number | null;
  band: string;
}

interface SSIDGroup {
  ssid: string;
  apCount: number;
  bestSignal: number;
  band: string;
  security: string;
  bssids: BSSIDEntry[];
}

function inferBand(channel: number | null, band: string | null): string {
  if (band) return band;
  if (channel === null) return "?";
  return channel <= 14 ? "2.4 GHz" : "5 GHz";
}

function signalToPercent(signal: number): number {
  const clamped = Math.max(-90, Math.min(-30, signal));
  return Math.round(((clamped + 90) / 60) * 100);
}

function signalColor(signal: number): string {
  const pct = signalToPercent(signal);
  if (pct >= 70) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

function signalLabel(signal: number): string {
  const pct = signalToPercent(signal);
  if (pct >= 70) return "Strong";
  if (pct >= 40) return "Fair";
  return "Weak";
}

function groupBySSID(networks: RawNetwork[]): SSIDGroup[] {
  const map = new Map<string, SSIDGroup>();
  for (const n of networks) {
    const ssid = n.ssid || "(hidden)";
    const band = inferBand(n.channel, n.band);
    const existing = map.get(ssid);
    if (existing) {
      existing.apCount += 1;
      if (n.signal > existing.bestSignal) existing.bestSignal = n.signal;
      existing.bssids.push({ bssid: n.bssid, signal: n.signal, channel: n.channel, band });
    } else {
      map.set(ssid, {
        ssid,
        apCount: 1,
        bestSignal: n.signal,
        band,
        security: n.security || "Open",
        bssids: [{ bssid: n.bssid, signal: n.signal, channel: n.channel, band }],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.bestSignal - a.bestSignal);
}

function SignalBar({ signal }: { signal: number }) {
  const pct = signalToPercent(signal);
  const color = signalColor(signal);
  const bars = 4;
  const filled = Math.ceil((pct / 100) * bars);
  return (
    <span className="inline-flex items-end gap-[2px]" title={`${signal} dBm — ${signalLabel(signal)}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ display: "inline-block", width: 4, height: 6 + i * 3, borderRadius: 1, backgroundColor: i < filled ? color : "#374151", transition: "background-color 0.3s" }} />
      ))}
    </span>
  );
}

function Badge({ label, variant = "default" }: { label: string; variant?: "default" | "green" | "amber" | "blue" | "red" }) {
  const colors: Record<string, string> = {
    default: "bg-gray-700 text-gray-300",
    green:   "bg-green-900/60 text-green-400 border border-green-700/40",
    amber:   "bg-amber-900/60 text-amber-400 border border-amber-700/40",
    blue:    "bg-blue-900/60 text-blue-400 border border-blue-700/40",
    red:     "bg-red-900/60 text-red-400 border border-red-700/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide ${colors[variant]}`}>
      {label}
    </span>
  );
}

function securityVariant(sec: string): "default" | "green" | "amber" | "blue" | "red" {
  const s = sec.toLowerCase();
  if (s.includes("wpa3")) return "green";
  if (s.includes("wpa2")) return "blue";
  if (s.includes("wpa")) return "amber";
  if (s === "open") return "red";
  return "default";
}

function bandVariant(band: string): "default" | "green" | "amber" | "blue" | "red" {
  if (band.includes("5")) return "blue";
  if (band.includes("2.4")) return "amber";
  return "default";
}

function SSIDRow({ group }: { group: SSIDGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-700/60 rounded-lg overflow-hidden mb-2 bg-gray-900/60 hover:border-gray-600/80 transition-colors">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors">
        <span className="text-gray-500 flex-shrink-0 w-4">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <SignalBar signal={group.bestSignal} />
        <span className="flex-1 font-mono text-sm text-gray-100 truncate min-w-0">{group.ssid}</span>
        <span className="text-xs text-gray-500 font-mono flex-shrink-0">{group.apCount} AP{group.apCount !== 1 ? "s" : ""}</span>
        <span className="text-xs font-mono flex-shrink-0 w-16 text-right" style={{ color: signalColor(group.bestSignal) }}>{group.bestSignal} dBm</span>
        <span className="flex-shrink-0"><Badge label={group.band} variant={bandVariant(group.band)} /></span>
        <span className="flex-shrink-0"><Badge label={group.security} variant={securityVariant(group.security)} /></span>
      </button>
      {open && (
        <div className="border-t border-gray-700/50 bg-gray-950/60">
          <div className="px-4 py-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1 px-1">
              <span>BSSID</span>
              <span className="text-right">Channel</span>
              <span className="text-right">Band</span>
              <span className="text-right">Signal</span>
            </div>
            {group.bssids.sort((a, b) => b.signal - a.signal).map((b) => (
              <div key={b.bssid} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-1 py-1.5 rounded hover:bg-gray-800/40 transition-colors">
                <span className="font-mono text-xs text-gray-400">{b.bssid}</span>
                <span className="font-mono text-xs text-gray-400 text-right">{b.channel !== null ? `ch ${b.channel}` : "—"}</span>
                <span className="text-right"><Badge label={b.band} variant={bandVariant(b.band)} /></span>
                <div className="flex items-center gap-2 justify-end">
                  <SignalBar signal={b.signal} />
                  <span className="font-mono text-xs w-16 text-right" style={{ color: signalColor(b.signal) }}>{b.signal} dBm</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RFRunnerLivePage() {
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [groups, setGroups] = useState<SSIDGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/rfrunner/live");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const deviceData: ScanResult = Array.isArray(json.devices) ? json.devices[0] : json;
      setScanData(deviceData);
      setGroups(groupBySSID(deviceData?.networks ?? []));
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalAPs = groups.reduce((sum, g) => sum + g.apCount, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Radio size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RF Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300"><span className="text-white font-semibold">{groups.length}</span> SSIDs</span>
            <span className="px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300"><span className="text-white font-semibold">{totalAPs}</span> APs</span>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-mono">⚠ {error}</div>}
      {loading && !scanData && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-800/60 animate-pulse" />)}</div>}
      {!loading && groups.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Wifi size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-mono">No networks found in latest scan</p>
        </div>
      )}
      <div>{groups.map((g) => <SSIDRow key={g.ssid} group={g} />)}</div>
      {scanData?.device_id && (
        <div className="mt-6 text-[10px] font-mono text-gray-700 text-right">
          device {scanData.device_id} · scanned {scanData.scanned_at ? new Date(scanData.scanned_at).toLocaleString() : "—"}
        </div>
      )}
    </div>
  );
}
