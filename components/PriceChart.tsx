import type { Action, Bar } from "@/lib/types";

interface Props {
  bars: Bar[];
  fast: number[];
  slow: number[];
  upper: number[];
  lower: number[];
  volRatio: number[];
  markers: { date: string; action: Action }[];
  spikeThreshold: number;
}

const W = 760;
const PRICE_H = 260;
const VOL_H = 70;
const PAD_L = 8;
const PAD_R = 56;
const GAP = 14;

export default function PriceChart({ bars, fast, slow, upper, lower, volRatio, markers, spikeThreshold }: Props) {
  const n = bars.length;
  if (n < 2) return <div className="empty">Not enough data yet</div>;

  const vals = [
    ...bars.flatMap((b) => [b.high, b.low]),
    ...upper.filter(Number.isFinite),
    ...lower.filter(Number.isFinite),
  ];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.06 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const innerW = W - PAD_L - PAD_R;
  const step = innerW / n;
  const x = (i: number) => PAD_L + step * (i + 0.5);
  const y = (v: number) => PRICE_H - ((v - lo) / (hi - lo)) * PRICE_H;

  const line = (series: number[]) =>
    series
      .map((v, i) => (Number.isFinite(v) ? `${x(i)},${y(v)}` : null))
      .filter(Boolean)
      .join(" ");

  const bandIdx = upper.map((v, i) => (Number.isFinite(v) && Number.isFinite(lower[i]) ? i : -1)).filter((i) => i >= 0);
  const bandPath =
    bandIdx.length > 1
      ? `M ${bandIdx.map((i) => `${x(i)},${y(upper[i])}`).join(" L ")} L ${[...bandIdx]
          .reverse()
          .map((i) => `${x(i)},${y(lower[i])}`)
          .join(" L ")} Z`
      : "";

  const maxVol = Math.max(...bars.map((b) => b.volume)) || 1;
  const volTop = PRICE_H + GAP;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (hi - lo) * t);
  const dateIdx = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
  const markerMap = new Map(markers.map((m) => [m.date, m.action]));
  const candleW = Math.max(2, step * 0.6);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${PRICE_H + GAP + VOL_H + 20}`} width="100%" role="img" aria-label="Price chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={W - PAD_R + 6} y={y(t) + 4} fill="var(--muted)" fontSize={11}>
              {t.toFixed(t < 10 ? 2 : 1)}
            </text>
          </g>
        ))}

        {bandPath && <path d={bandPath} fill="rgba(76,154,255,0.08)" stroke="rgba(76,154,255,0.25)" />}

        {bars.map((b, i) => {
          const upDay = b.close >= b.open;
          const color = upDay ? "var(--buy)" : "var(--sell)";
          const top = y(Math.max(b.open, b.close));
          const bodyH = Math.max(1, Math.abs(y(b.open) - y(b.close)));
          return (
            <g key={b.date}>
              <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
              <rect x={x(i) - candleW / 2} y={top} width={candleW} height={bodyH} fill={color} rx={1}>
                <title>
                  {`${b.date}\nO ${b.open.toFixed(2)}  H ${b.high.toFixed(2)}\nL ${b.low.toFixed(2)}  C ${b.close.toFixed(2)}`}
                </title>
              </rect>
            </g>
          );
        })}

        <polyline points={line(fast)} fill="none" stroke="var(--line-fast)" strokeWidth={1.6} />
        <polyline points={line(slow)} fill="none" stroke="var(--line-slow)" strokeWidth={1.6} />

        {bars.map((b, i) => {
          const a = markerMap.get(b.date);
          if (!a || a === "HOLD") return null;
          const buy = a === "BUY";
          const yy = buy ? y(b.low) + 12 : y(b.high) - 12;
          const pts = buy
            ? `${x(i)},${yy - 6} ${x(i) - 5},${yy + 3} ${x(i) + 5},${yy + 3}`
            : `${x(i)},${yy + 6} ${x(i) - 5},${yy - 3} ${x(i) + 5},${yy - 3}`;
          return (
            <polygon key={`m-${b.date}`} points={pts} fill={buy ? "var(--buy)" : "var(--sell)"}>
              <title>{`${a} signal on ${b.date}`}</title>
            </polygon>
          );
        })}

        {bars.map((b, i) => {
          const h = (b.volume / maxVol) * VOL_H;
          const spike = Number.isFinite(volRatio[i]) && volRatio[i] >= spikeThreshold;
          return (
            <rect
              key={`v-${b.date}`}
              x={x(i) - candleW / 2}
              y={volTop + VOL_H - h}
              width={candleW}
              height={h}
              fill={spike ? "var(--hold)" : "rgba(139,152,168,0.35)"}
            >
              <title>{`${b.date}: ${b.volume.toLocaleString()}${spike ? ` (${volRatio[i].toFixed(1)}x avg)` : ""}`}</title>
            </rect>
          );
        })}

        {dateIdx.map((i) => (
          <text key={`d-${i}`} x={x(i)} y={volTop + VOL_H + 15} fill="var(--muted)" fontSize={11} textAnchor="middle">
            {bars[i].date.slice(5)}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--line-fast)" }} />5-day avg</span>
        <span><i style={{ background: "var(--line-slow)" }} />20-day avg</span>
        <span><i style={{ background: "rgba(76,154,255,0.5)" }} />Bollinger bands</span>
        <span><i style={{ background: "var(--hold)" }} />Volume spike</span>
        <span>▲▼ Buy / sell signals</span>
      </div>
    </div>
  );
}
