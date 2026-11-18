import {
  bollinger,
  macd,
  regressionSlopePct,
  returns,
  rollingZ,
  rsi,
  sma,
  volumeRatio,
  type Bands,
  type Macd,
} from "./indicators";
import type { Action, Bar, Outlier, Reason, Signal } from "./types";

/** Tunable thresholds. Change these, then check the backtest. */
export const CONFIG = {
  fastMa: 5,
  slowMa: 20,
  crossLookback: 3,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  trendWindow: 30,
  volumeSpike: 2,
  returnZOutlier: 2.5,
  buyThreshold: 30,
  sellThreshold: -30,
};

/** Bars needed before the first signal can be produced */
export const WARMUP = 35;

export interface IndicatorSet {
  closes: number[];
  fast: number[];
  slow: number[];
  rsi: number[];
  macd: Macd;
  bands: Bands;
  slope: number[];
  volRatio: number[];
  retZ: number[];
}

export function computeIndicators(bars: Bar[]): IndicatorSet {
  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  return {
    closes,
    fast: sma(closes, CONFIG.fastMa),
    slow: sma(closes, CONFIG.slowMa),
    rsi: rsi(closes, CONFIG.rsiPeriod),
    macd: macd(closes),
    bands: bollinger(closes),
    slope: regressionSlopePct(closes, CONFIG.trendWindow),
    volRatio: volumeRatio(vols),
    retZ: rollingZ(returns(closes), CONFIG.trendWindow),
  };
}

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x));

/** Score the bar at index `i` using only data up to and including `i` (no lookahead). */
export function signalAt(bars: Bar[], ind: IndicatorSet, i: number): Signal | null {
  if (i < WARMUP - 1 || i >= bars.length) return null;
  const reasons: Reason[] = [];
  const outliers: Outlier[] = [];
  const add = (key: string, label: string, points: number) =>
    reasons.push({ key, label, points: Math.round(points) });

  const close = ind.closes[i];

  // 1. Moving-average trend + recent crossover
  const f = ind.fast[i];
  const s = ind.slow[i];
  if (ok(f, s)) {
    if (f > s) add("ma_trend", `${CONFIG.fastMa}-day average above ${CONFIG.slowMa}-day (uptrend)`, 20);
    else add("ma_trend", `${CONFIG.fastMa}-day average below ${CONFIG.slowMa}-day (downtrend)`, -20);

    for (let k = 1; k <= CONFIG.crossLookback && i - k >= 0; k++) {
      const pf = ind.fast[i - k];
      const ps = ind.slow[i - k];
      const pf2 = ind.fast[i - k + 1];
      const ps2 = ind.slow[i - k + 1];
      if (!ok(pf, ps, pf2, ps2)) continue;
      if (pf <= ps && pf2 > ps2) {
        add("ma_cross", `Bullish crossover ${k} day${k > 1 ? "s" : ""} ago`, 10);
        break;
      }
      if (pf >= ps && pf2 < ps2) {
        add("ma_cross", `Bearish crossover ${k} day${k > 1 ? "s" : ""} ago`, -10);
        break;
      }
    }
  }

  // 2. 30-day regression slope (% per day). ~0.3%/day ≈ +9% a month → full points.
  const slope = ind.slope[i];
  if (ok(slope)) {
    const pts = Math.max(-15, Math.min(15, (slope / 0.3) * 15));
    if (Math.abs(pts) >= 3) {
      add(
        "slope",
        `${CONFIG.trendWindow}-day trend ${slope >= 0 ? "+" : ""}${slope.toFixed(2)}% / day`,
        pts,
      );
    }
  }

  // 3. RSI extremes (mean-reversion)
  const r = ind.rsi[i];
  if (ok(r)) {
    if (r < CONFIG.rsiOversold) add("rsi", `RSI ${r.toFixed(0)} - oversold`, 20);
    else if (r > CONFIG.rsiOverbought) add("rsi", `RSI ${r.toFixed(0)} - overbought`, -20);
  }

  // 4. MACD histogram: momentum direction and fresh cross
  const h = ind.macd.histogram[i];
  const hPrev = ind.macd.histogram[i - 1];
  if (ok(h, hPrev)) {
    if (hPrev <= 0 && h > 0) add("macd", "MACD crossed above signal line", 15);
    else if (hPrev >= 0 && h < 0) add("macd", "MACD crossed below signal line", -15);
    else if (h > 0 && h > hPrev) add("macd", "MACD momentum building", 8);
    else if (h < 0 && h < hPrev) add("macd", "MACD momentum fading", -8);
  }

  // 5. Bollinger band breaches (mean-reversion)
  const up = ind.bands.upper[i];
  const lo = ind.bands.lower[i];
  if (ok(up, lo)) {
    if (close < lo) add("bollinger", "Closed below lower Bollinger band", 15);
    else if (close > up) add("bollinger", "Closed above upper Bollinger band", -15);
  }

  // 6. Volume spike confirms the day's direction
  const vr = ind.volRatio[i];
  const dayMove = i > 0 ? close / ind.closes[i - 1] - 1 : 0;
  if (ok(vr) && vr >= CONFIG.volumeSpike) {
    outliers.push({ key: "volume", label: `Volume ${vr.toFixed(1)}x the 20-day average` });
    add(
      "volume",
      `High-volume ${dayMove >= 0 ? "up" : "down"} day (${vr.toFixed(1)}x avg)`,
      dayMove >= 0 ? 10 : -10,
    );
  }

  // 7. Unusual price move - flagged, not scored
  const z = ind.retZ[i];
  if (ok(z) && Math.abs(z) >= CONFIG.returnZOutlier) {
    outliers.push({
      key: "return",
      label: `${(dayMove * 100).toFixed(1)}% move is a ${z.toFixed(1)}σ outlier`,
    });
  }

  const raw = reasons.reduce((a, b) => a + b.points, 0);
  const score = Math.max(-100, Math.min(100, raw));
  const action: Action =
    score >= CONFIG.buyThreshold ? "BUY" : score <= CONFIG.sellThreshold ? "SELL" : "HOLD";

  // Confidence = share of signal weight pointing the same way as the score
  const total = reasons.reduce((a, b) => a + Math.abs(b.points), 0);
  const agreeing = reasons
    .filter((x) => Math.sign(x.points) === Math.sign(score))
    .reduce((a, b) => a + Math.abs(b.points), 0);
  const confidence = total === 0 || score === 0 ? 0 : agreeing / total;

  reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    date: bars[i].date,
    close,
    score,
    action,
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    outliers,
  };
}

export function latestSignal(bars: Bar[]): Signal | null {
  if (bars.length < WARMUP) return null;
  return signalAt(bars, computeIndicators(bars), bars.length - 1);
}
