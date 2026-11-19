"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RANGES, type ChartData, type ChartRange } from "@/lib/chart-types";

const TZ = "Europe/London";

export function RangeToggle({ value, onChange }: { value: ChartRange; onChange: (r: ChartRange) => void }) {
  return (
    <div className="segmented" role="tablist">
      {RANGES.map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={value === r}
          className={value === r ? "active" : ""}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

interface Props {
  ticker: string;
  /** Controlled range (e.g. from a dashboard-wide toggle). Omit to show this chart's own toggle. */
  range?: ChartRange;
  height?: number;
  compact?: boolean;
}

export default function RangeChart({ ticker, range: controlled, height = 220, compact = false }: Props) {
  const [own, setOwn] = useState<ChartRange>("1D");
  const range = controlled ?? own;
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const cache = useRef(new Map<string, ChartData>());

  useEffect(() => {
    const key = `${ticker}:${range}`;
    const cached = cache.current.get(key);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}&range=${range}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        return json as ChartData;
      })
      .then((d) => {
        if (cancelled) return;
        cache.current.set(key, d);
        setData(d);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  const W = 600;
  const H = height;
  const PAD_T = 8;
  const PAD_B = 22;

  const geo = useMemo(() => {
    if (!data || data.points.length < 2) return null;
    const pts = data.points;
    const closes = pts.map((p) => p.close);
    const all = data.baseline != null ? [...closes, data.baseline] : closes;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || max * 0.01 || 1;
    const lo = min - pad;
    const hi = max + pad;
    // x by index, so overnight/weekend gaps don't leave empty space
    const x = (i: number) => (i / (pts.length - 1)) * W;
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" L ");
    const area = `M 0,${H - PAD_B} L ${line} L ${W},${H - PAD_B} Z`;
    return { pts, x, y, line: `M ${line}`, area, min, max };
  }, [data, H]);

  const last = data?.points[data.points.length - 1];
  const base = data?.baseline ?? data?.points[0]?.close ?? null;
  const shown = hover != null && geo ? geo.pts[hover] : last;
  const change = shown && base ? (shown.close / base - 1) * 100 : null;
  const up = (change ?? 0) >= 0;
  const color = up ? "var(--buy)" : "var(--sell)";
  const gradId = `g-${ticker.replace(/[^a-z0-9]/gi, "")}-${range}`;

  const fmtTime = (t: number) => {
    if (!data?.intraday) {
      return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    }
    const d = new Date(t);
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
    if (range === "1D") return time;
    return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: TZ })} ${time}`;
  };

  // A few x-axis labels: for 1W, one per trading day
  const xLabels = useMemo(() => {
    if (!geo || !data) return [] as { i: number; label: string }[];
    const n = geo.pts.length;
    if (range === "1W") {
      const out: { i: number; label: string }[] = [];
      let prevDay = "";
      geo.pts.forEach((p, i) => {
        const day = new Date(p.t).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
        if (day !== prevDay) out.push({ i, label: day });
        prevDay = day;
      });
      return out;
    }
    return [0, Math.floor(n / 2), n - 1].map((i) => ({
      i,
      label: data.intraday
        ? new Date(geo.pts[i].t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
        : new Date(geo.pts[i].t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    }));
  }, [geo, data, range]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (geo.pts.length - 1)));
  };

  const sessionLabel =
    data && range === "1D" && data.points.length
      ? new Date(data.points[0].t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
      : null;

  return (
    <div className="range-chart">
      <div className="row spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: compact ? 20 : 26, fontWeight: 700 }}>
              {shown ? shown.close.toFixed(2) : "-"}
            </span>
            {change != null && (
              <span className="mono" style={{ color, fontWeight: 600 }}>
                {up ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="muted small">
            {hover != null && shown
              ? fmtTime(shown.t)
              : range === "1D"
                ? `Last session${sessionLabel ? ` · ${sessionLabel}` : ""} (UK time)`
                : range === "1W"
                  ? "Last 5 sessions (UK time)"
                  : "Last 30 trading days"}
          </div>
        </div>
        {!controlled && <RangeToggle value={own} onChange={setOwn} />}
      </div>

      <div style={{ position: "relative", marginTop: 8 }}>
        {loading && !geo && <div className="chart-placeholder" style={{ height: H }}>Loading...</div>}
        {error && !loading && (
          <div className="chart-placeholder down" style={{ height: H }}>
            Couldn&apos;t load {range} data: {error}
          </div>
        )}
        {geo && !error && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            preserveAspectRatio="none"
            style={{ display: "block", height: H, opacity: loading ? 0.5 : 1, touchAction: "none" }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {base != null && (
              <line
                x1={0}
                x2={W}
                y1={geo.y(base)}
                y2={geo.y(base)}
                stroke="var(--muted)"
                strokeOpacity={0.5}
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path d={geo.area} fill={`url(#${gradId})`} />
            <path d={geo.line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {hover != null && (
              <>
                <line
                  x1={geo.x(hover)}
                  x2={geo.x(hover)}
                  y1={PAD_T}
                  y2={H - PAD_B}
                  stroke="var(--muted)"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
        )}
        {geo && !error && hover != null && (
          <span
            className="chart-dot"
            style={{ left: `${(geo.x(hover) / W) * 100}%`, top: geo.y(geo.pts[hover].close), background: color }}
          />
        )}
        {geo && !error && (
          <div className="x-labels">
            {xLabels.map((l) => (
              <span key={l.i} style={{ left: `${(l.i / (geo.pts.length - 1)) * 100}%` }}>
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {geo && !compact && (
        <div className="row small muted" style={{ marginTop: 10, gap: 18 }}>
          <span>High <span className="mono">{geo.max.toFixed(2)}</span></span>
          <span>Low <span className="mono">{geo.min.toFixed(2)}</span></span>
          {base != null && (
            <span>
              {range === "1D" ? "Prev close" : "Start"} <span className="mono">{base.toFixed(2)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
