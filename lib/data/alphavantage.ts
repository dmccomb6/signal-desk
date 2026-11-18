import type { Bar } from "../types";

// Free tier: 25 requests/day and the "compact" output (latest 100 trading days).
// London tickers use the ".LON" suffix here, e.g. "VOD.LON".
export async function fetchAlphaVantageDaily(ticker: string): Promise<Bar[]> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  const symbol = ticker.endsWith(".L") ? ticker.replace(/\.L$/, ".LON") : ticker;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
    symbol,
  )}&outputsize=compact&apikey=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`AlphaVantage ${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  const series = json["Time Series (Daily)"];
  if (!series) {
    throw new Error(`AlphaVantage ${ticker}: ${json.Note ?? json.Information ?? json["Error Message"] ?? "no data"}`);
  }
  return Object.entries(series as Record<string, Record<string, string>>)
    .map(([date, v]) => ({
      date,
      open: Number(v["1. open"]),
      high: Number(v["2. high"]),
      low: Number(v["3. low"]),
      close: Number(v["4. close"]),
      volume: Number(v["5. volume"]),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
