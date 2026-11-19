import "server-only";
import { fetchYahooIntraday } from "./data/yahoo";
import { getBars } from "./db";
import type { ChartData, ChartRange } from "./chart-types";

export { RANGES } from "./chart-types";
export type { ChartData, ChartPoint, ChartRange } from "./chart-types";

export async function getChartData(ticker: string, range: ChartRange): Promise<ChartData> {
  if (range === "30D") {
    // 31 stored daily bars: 30 to plot + the one before as the baseline
    const bars = await getBars(ticker, 31);
    const plot = bars.length > 30 ? bars.slice(1) : bars;
    return {
      ticker,
      range,
      points: plot.map((b) => ({ t: Date.parse(`${b.date}T21:00:00Z`), close: b.close })),
      baseline: bars.length > 30 ? bars[0].close : (plot[0]?.close ?? null),
      intraday: false,
      currency: null,
    };
  }

  const series =
    range === "1D" ? await fetchYahooIntraday(ticker, "1d", "5m") : await fetchYahooIntraday(ticker, "5d", "15m");
  return {
    ticker,
    range,
    points: series.points.map((p) => ({ t: p.t, close: p.close })),
    baseline: series.previousClose ?? series.points[0]?.close ?? null,
    intraday: true,
    currency: series.currency,
  };
}
