import type { Action } from "@/lib/types";

export function ActionBadge({ action, isNew }: { action: Action; isNew?: boolean }) {
  return (
    <span>
      <span className={`badge ${action}`}>{action}</span>
      {isNew && <span className="badge new">NEW</span>}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.abs(score), 100) / 2; // half the bar each side
  const color = score > 0 ? "var(--buy)" : score < 0 ? "var(--sell)" : "var(--hold)";
  const style =
    score >= 0
      ? { left: "50%", width: `${pct}%`, background: color }
      : { left: `${50 - pct}%`, width: `${pct}%`, background: color };
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="scorebar">
        <div className="mid" />
        <div className="fill" style={style} />
      </div>
      <span className="mono small" style={{ color, minWidth: 34 }}>
        {score > 0 ? "+" : ""}
        {score}
      </span>
    </div>
  );
}

export function Pct({ value, digits = 1 }: { value: number; digits?: number }) {
  if (!Number.isFinite(value)) return <span className="muted">-</span>;
  return (
    <span className={`mono ${value >= 0 ? "up" : "down"}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(digits)}%
    </span>
  );
}

export function Sparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={up ? "var(--buy)" : "var(--sell)"} strokeWidth={1.6} />
    </svg>
  );
}
