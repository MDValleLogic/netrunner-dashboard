import React from "react";

export const dynamic = "force-dynamic";

export default function NetRunnerDashboard() {
  return (
    <div style={{ padding: 28, fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ opacity: 0.7, fontSize: 13, letterSpacing: 0.4 }}>NetRunner</div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Dashboard</h1>
          <div style={{ marginTop: 6, opacity: 0.7 }}>Authenticated suite: LiveView + HistoryView</div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <a href="/webrunner/live" style={cardStyle}>
          <div style={cardTitle}>WebRunner Live</div>
          <div style={cardBody}>Real-time view of latest measurements and device last-seen.</div>
          <div style={cardCta}>Open Live →</div>
        </a>

        <a href="/webrunner/history" style={cardStyle}>
          <div style={cardTitle}>WebRunner History</div>
          <div style={cardBody}>Historical trends, baselines, percentiles, and anomalies over time.</div>
          <div style={cardCta}>Open History →</div>
        </a>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "white",
  textDecoration: "none",
  color: "inherit",
};

const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 650 };
const cardBody: React.CSSProperties = { marginTop: 6, opacity: 0.75, lineHeight: 1.35 };
const cardCta: React.CSSProperties = { marginTop: 12, fontSize: 13, opacity: 0.9 };
