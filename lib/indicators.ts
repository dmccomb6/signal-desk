// Pure indicator maths. Every function returns an array aligned to the input,
// with NaN where there isn't enough history yet.

export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface Macd {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): Macd {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const line = closes.map((_, i) => fastE[i] - slowE[i]);
  // EMA of the MACD line, only over the part where it's defined
  const firstValid = line.findIndex((v) => !Number.isNaN(v));
  const signal = new Array<number>(closes.length).fill(NaN);
  if (firstValid >= 0) {
    const sig = ema(line.slice(firstValid), signalPeriod);
    sig.forEach((v, j) => (signal[firstValid + j] = v));
  }
  const histogram = line.map((v, i) => v - signal[i]);
  return { macd: line, signal, histogram };
}

export interface Bands {
  middle: number[];
  upper: number[];
  lower: number[];
}

export function bollinger(closes: number[], period = 20, mult = 2): Bands {
  const middle = sma(closes, period);
  const upper = new Array<number>(closes.length).fill(NaN);
  const lower = new Array<number>(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const sd = stdev(closes.slice(i - period + 1, i + 1));
    upper[i] = middle[i] + mult * sd;
    lower[i] = middle[i] - mult * sd;
  }
  return { middle, upper, lower };
}

/** Daily simple returns; index 0 is NaN */
export function returns(closes: number[]): number[] {
  return closes.map((c, i) => (i === 0 ? NaN : c / closes[i - 1] - 1));
}

/** z-score of each value against the trailing `period` values before it */
export function rollingZ(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = period; i < values.length; i++) {
    const window = values.slice(i - period, i).filter((v) => !Number.isNaN(v));
    if (window.length < period * 0.8) continue;
    const m = mean(window);
    const sd = stdev(window);
    out[i] = sd === 0 ? 0 : (values[i] - m) / sd;
  }
  return out;
}

/** Today's volume relative to the average of the previous `period` days */
export function volumeRatio(volumes: number[], period = 20): number[] {
  const out = new Array<number>(volumes.length).fill(NaN);
  for (let i = period; i < volumes.length; i++) {
    const avg = mean(volumes.slice(i - period, i));
    out[i] = avg === 0 ? NaN : volumes[i] / avg;
  }
  return out;
}

/**
 * Slope of a least-squares line through the last `period` closes,
 * expressed as % of the latest regression value per day.
 */
export function regressionSlopePct(closes: number[], period = 30): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const ys = closes.slice(i - period + 1, i + 1);
    const n = ys.length;
    const xMean = (n - 1) / 2;
    const yMean = mean(ys);
    let num = 0;
    let den = 0;
    for (let x = 0; x < n; x++) {
      num += (x - xMean) * (ys[x] - yMean);
      den += (x - xMean) ** 2;
    }
    const slope = num / den;
    const fitted = yMean + slope * (n - 1 - xMean);
    out[i] = fitted === 0 ? NaN : (slope / fitted) * 100;
  }
  return out;
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
