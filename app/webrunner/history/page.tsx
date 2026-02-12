import React from "react";

export const dynamic = "force-dynamic";

export default function WebRunnerHistory() {
  return (
    <div style={{ padding: 28, fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>WebRunner History</h1>
      <div style={{ marginTop: 8, opacity: 0.7 }}>
        Next: baselines (p50/p95), trends, and charts. LiveView proves the pipeline.
      </div>
    </div>
  );
}
