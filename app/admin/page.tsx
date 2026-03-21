"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardShell from "@/components/DashboardShell";

type PlatformTotals = {
  total_tenants: number;
  total_devices: number;
  online_devices: number;
  total_users: number;
  verified_users: number;
};

type Tenant = {
  tenant_id: string;
  tenant_name: string;
  email: string;
  device_count: number;
  last_active: string | null;
  registered_at: string;
  email_verified: boolean;
  mfa_enabled: boolean;
};

type Device = {
  device_id: string;
  device_name: string | null;
  status: string;
  computed_status: "online" | "idle" | "offline" | "never_seen";
  ip_address: string | null;
  last_seen: string | null;
  agent_version: string | null;
  tenant_name: string;
  owner_email: string | null;
  seconds_since_heartbeat: number | null;
};

type ActivityEvent = {
  event_type: "signup" | "claim" | "verified";
  email: string;
  tenant_name: string;
  event_at: string;
  device_id: string | null;
};

type Alert = {
  level: "error" | "warning" | "info";
  message: string;
};

type OfflineDevice = {
  device_id: string;
  device_name: string | null;
  ip_address: string | null;
  last_seen: string | null;
  tenant_name: string;
  owner_email: string | null;
  hours_offline: number;
};

type UnverifiedUser = {
  email: string;
  tenant_name: string;
  created_at: string;
};

function timeAgo(ts: string | null): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusDot(status: Device["computed_status"]) {
  const colors: Record<string, string> = {
    online: "bg-green-400",
    idle: "bg-yellow-400",
    offline: "bg-red-500",
    never_seen: "bg-zinc-500",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${colors[status] ?? "bg-zinc-500"}`} />
  );
}

function eventBadge(type: ActivityEvent["event_type"]) {
  const styles: Record<string, string> = {
    signup: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    claim: "bg-green-500/20 text-green-300 border border-green-500/30",
    verified: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${styles[type] ?? ""}`}>
      {type}
    </span>
  );
}

function StatCard({ label, value, sub, color = "text-white" }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

const TABS = ["Tenants", "Devices", "Activity", "Health"] as const;
type Tab = (typeof TABS)[number];

export default function OverlordPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Tenants");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [totals, setTotals] = useState<PlatformTotals | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<OfflineDevice[]>([]);
  const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, devicesRes, healthRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/devices"),
        fetch("/api/admin/health"),
      ]);
      const [overview, devData, health] = await Promise.all([
        overviewRes.json(),
        devicesRes.json(),
        healthRes.json(),
      ]);
      setTotals(overview.totals);
      setTenants(overview.tenants ?? []);
      setActivity(overview.recentActivity ?? []);
      setDevices(devData.devices ?? []);
      setAlerts(health.alerts ?? []);
      setOfflineDevices(health.offlineDevices ?? []);
      setUnverifiedUsers(health.unverifiedUsers ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Overlord fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const TenantsTab = () => (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Tenant</th>
            <th className="px-4 py-3 text-center">Devices</th>
            <th className="px-4 py-3 text-left">Last Active</th>
            <th className="px-4 py-3 text-left">Registered</th>
            <th className="px-4 py-3 text-center">Verified</th>
            <th className="px-4 py-3 text-center">MFA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {tenants.map((t) => (
            <tr key={t.tenant_id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-zinc-200">{t.email}</td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{t.tenant_name ?? t.tenant_id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-center font-semibold text-white">{t.device_count}</td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{timeAgo(t.last_active)}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(t.registered_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-center">
                {t.email_verified ? <span className="text-green-400 text-xs">✓</span> : <span className="text-red-400 text-xs">✗</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {t.mfa_enabled ? <span className="text-green-400 text-xs">✓</span> : <span className="text-zinc-600 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const DevicesTab = () => (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left">Device ID</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Tenant</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-left">IP</th>
            <th className="px-4 py-3 text-left">Last Seen</th>
            <th className="px-4 py-3 text-left">Agent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {devices.map((d) => (
            <tr key={d.device_id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-zinc-200">{d.device_id}</td>
              <td className="px-4 py-3">
                <span className="flex items-center text-xs text-zinc-300">
                  {statusDot(d.computed_status)}{d.computed_status}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{d.tenant_name}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">{d.owner_email ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-400">{d.ip_address ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{timeAgo(d.last_seen)}</td>
              <td className="px-4 py-3 text-zinc-600 text-xs">{d.agent_version ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ActivityTab = () => (
    <div className="space-y-2">
      {activity.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-12">No recent activity.</p>
      )}
      {activity.map((ev, i) => (
        <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            {eventBadge(ev.event_type)}
            <span className="font-mono text-xs text-zinc-200">{ev.email}</span>
            {ev.device_id && <span className="font-mono text-xs text-zinc-500">→ {ev.device_id}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>{ev.tenant_name}</span>
            <span>{timeAgo(ev.event_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const HealthTab = () => (
    <div className="space-y-6">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          a.level === "error" ? "bg-red-950/40 border-red-800 text-red-300"
          : a.level === "warning" ? "bg-yellow-950/40 border-yellow-800 text-yellow-300"
          : "bg-blue-950/40 border-blue-800 text-blue-300"}`}>
          <span>{a.level === "error" ? "🔴" : a.level === "warning" ? "🟡" : "🔵"}</span>
          <span>{a.message}</span>
        </div>
      ))}
      {alerts.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-800 bg-green-950/30 px-4 py-3 text-sm text-green-300">
          <span>✅</span><span>All systems nominal — no active alerts.</span>
        </div>
      )}
      {offlineDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Offline Devices</h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Device</th>
                  <th className="px-4 py-3 text-left">Tenant</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Offline For</th>
                  <th className="px-4 py-3 text-left">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {offlineDevices.map((d) => (
                  <tr key={d.device_id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-200">{d.device_id}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{d.tenant_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{d.owner_email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{d.ip_address ?? "—"}</td>
                    <td className="px-4 py-3 text-red-400 text-xs font-semibold">
                      {d.hours_offline < 1 ? `${Math.round(d.hours_offline * 60)}m` : `${d.hours_offline.toFixed(1)}h`}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{timeAgo(d.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {unverifiedUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Unverified Emails</h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Tenant</th>
                  <th className="px-4 py-3 text-left">Signed Up</th>
                  <th className="px-4 py-3 text-left">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {unverifiedUsers.map((u) => (
                  <tr key={u.email} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-200">{u.email}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{u.tenant_name}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-yellow-400 bg-zinc-800 px-2 py-0.5 rounded font-mono">
                        UPDATE app_users SET email_verified=true WHERE email=&apos;{u.email}&apos;;
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">⚡ Project Overlord</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Internal operator dashboard · all tenants · all devices</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
            <button onClick={fetchAll} disabled={loading}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors border border-zinc-700">
              {loading ? "Refreshing…" : "↺ Refresh"}
            </button>
          </div>
        </div>

        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Tenants" value={totals.total_tenants} />
            <StatCard label="Total Devices" value={totals.total_devices} />
            <StatCard label="Online Now" value={totals.online_devices} color="text-green-400"
              sub={`${Math.round((totals.online_devices / Math.max(totals.total_devices, 1)) * 100)}% of fleet`} />
            <StatCard label="Users" value={totals.total_users} />
            <StatCard label="Verified" value={totals.verified_users}
              color={totals.verified_users < totals.total_users ? "text-yellow-400" : "text-green-400"}
              sub={`${totals.total_users - totals.verified_users} unverified`} />
          </div>
        )}

        {alerts.filter((a) => a.level === "error").map((a, i) => (
          <div key={i} className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
            🔴 {a.message}
          </div>
        ))}

        <div className="border-b border-zinc-800">
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                {tab}
                {tab === "Health" && alerts.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{alerts.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {loading && !totals ? (
          <div className="flex items-center justify-center py-24 text-zinc-500">Loading Overlord data…</div>
        ) : (
          <div>
            {activeTab === "Tenants" && <TenantsTab />}
            {activeTab === "Devices" && <DevicesTab />}
            {activeTab === "Activity" && <ActivityTab />}
            {activeTab === "Health" && <HealthTab />}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
