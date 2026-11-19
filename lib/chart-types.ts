// Shared between the server (API route) and the client chart component.
export const RANGES = ["1D", "1W", "30D"] as const;
export type ChartRange = (typeof RANGES)[number];

export interface ChartPoint {
  t: number; // epoch ms
  close: number;
}

export interface ChartData {
  ticker: string;
  range: ChartRange;
  points: ChartPoint[];
  /** Price the % change is measured against (close before the range starts) */
  baseline: number | null;
  intraday: boolean;
  currency: string | null;
}
