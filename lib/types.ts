export interface Bar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Action = "BUY" | "SELL" | "HOLD";

export interface Reason {
  key: string;
  label: string;
  points: number; // contribution to score, +bullish / -bearish
}

export interface Outlier {
  key: string;
  label: string;
}

export interface Signal {
  date: string;
  close: number;
  score: number; // -100..100
  action: Action;
  confidence: number; // 0..1, how much the individual signals agree
  reasons: Reason[];
  outliers: Outlier[];
}

export interface SignalRow extends Signal {
  ticker: string;
  changed: boolean;
}
