import type { HealthCheck } from "@/lib/health";

export default function SetupPanel({ error, checks }: { error: string; checks: HealthCheck[] }) {
  return (
    <div className="stack">
      <div>
        <h1>Setup needed</h1>
        <p className="muted">The dashboard couldn&apos;t load its data. Fix the red items below, then reload.</p>
      </div>

      <div className="panel">
        <h2>Error</h2>
        <code style={{ display: "block", whiteSpace: "pre-wrap", padding: 10 }}>{error}</code>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th />
              <th>Check</th>
              <th>Result</th>
              <th>How to fix</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.name}>
                <td className={c.ok ? "up" : "down"} style={{ width: 28 }}>{c.ok ? "✓" : "✗"}</td>
                <td>{c.name}</td>
                <td className="small mono">{c.detail}</td>
                <td className="small">{c.fix ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted small">
        Same info as JSON at <code>/api/health</code>. Env var changes in Vercel only apply after a redeploy.
      </p>
    </div>
  );
}
