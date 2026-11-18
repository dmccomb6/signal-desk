interface Props {
  equity: { date: string; strategy: number; buyHold: number }[];
}

const W = 760;
const H = 200;
const PAD_R = 56;

export default function EquityChart({ equity }: Props) {
  if (equity.length < 2) return null;
  const all = equity.flatMap((e) => [e.strategy, e.buyHold]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || 0.01;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (equity.length - 1)) * (W - PAD_R);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = (key: "strategy" | "buyHold") => equity.map((e, i) => `${x(i)},${y(e[key])}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label="Strategy vs buy and hold">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={0} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={W - PAD_R + 6} y={y(t) + 4} fill="var(--muted)" fontSize={11}>
              {((t - 1) * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <line x1={0} x2={W - PAD_R} y1={y(1)} y2={y(1)} stroke="var(--muted)" strokeOpacity={0.4} />
        <polyline points={line("buyHold")} fill="none" stroke="var(--muted)" strokeWidth={1.5} />
        <polyline points={line("strategy")} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <text x={0} y={H + 15} fill="var(--muted)" fontSize={11}>{equity[0].date}</text>
        <text x={W - PAD_R} y={H + 15} fill="var(--muted)" fontSize={11} textAnchor="end">
          {equity[equity.length - 1].date}
        </text>
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />Signal strategy</span>
        <span><i style={{ background: "var(--muted)" }} />Buy &amp; hold</span>
      </div>
    </div>
  );
}
