import type { Bar } from "../types";

// Unofficial Yahoo Finance chart endpoint: no key, supports LSE tickers like "VOD.L".
// It can rate-limit or change without notice; switch DATA_PROVIDER to alphavantage if so.
const BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; signal-desk/0.1)" };

async function fetchChart(ticker: string, params: string, revalidate?: number) {
  const url = `${BASE}${encodeURIComponent(ticker)}?${params}`;
  const res = await fetch(url, {
    headers: HEADERS,
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
  });
  if (!res.ok) throw new Error(`Yahoo ${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${ticker}: ${json?.chart?.error?.description ?? "no data"}`);
  return result;
}

/** Daily OHLCV bars, used by the ingest job */
export async function fetchYahooDaily(ticker: string, range = "2y"): Promise<Bar[]> {
  const result = await fetchChart(ticker, `range=${range}&interval=1d&events=split`);
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const offset: number = result.meta?.gmtoffset ?? 0;
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const [o, h, l, c, v] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i], q.volume?.[i]];
    if ([o, h, l, c].some((x) => x == null)) continue; // holidays / partial rows
    bars.push({
      date: new Date((ts[i] + offset) * 1000).toISOString().slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v ?? 0,
    });
  }
  return dedupe(bars);
}

export interface IntradayPoint {
  t: number; // epoch ms
  close: number;
  volume: number;
}

export interface IntradaySeries {
  points: IntradayPoint[];
  previousClose: number | null;
  currency: string | null;
  timezone: string | null;
}

/**
 * Intraday prices for the chart toggles. range "1d" = the latest session
 * (yesterday's, before today's open), "5d" = the last five sessions.
 */
export async function fetchYahooIntraday(
  ticker: string,
  range: "1d" | "5d",
  interval: "5m" | "15m",
): Promise<IntradaySeries> {
  const result = await fetchChart(ticker, `range=${range}&interval=${interval}&includePrePost=false`, 300);
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const points: IntradayPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null) continue;
    points.push({ t: ts[i] * 1000, close: c, volume: q.volume?.[i] ?? 0 });
  }
  const meta = result.meta ?? {};
  return {
    points,
    previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    currency: meta.currency ?? null,
    timezone: meta.exchangeTimezoneName ?? null,
  };
}

function dedupe(bars: Bar[]): Bar[] {
  const map = new Map<string, Bar>();
  for (const b of bars) map.set(b.date, b);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
