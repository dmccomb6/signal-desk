import "server-only";
import { fetchDaily } from "./data";
import { getWatchlist, saveSignals, upsertBars } from "./db";
import { computeIndicators, signalAt } from "./signals";
import type { Action, Signal } from "./types";

export interface IngestResult {
  ticker: string;
  ok: boolean;
  bars?: number;
  latest?: { date: string; action: Action; score: number; changed: boolean; previous: Action | null };
  error?: string;
}

/** How many recent days of signals to (re)write each run */
const SIGNAL_DAYS = 30;

export async function ingestTicker(ticker: string): Promise<IngestResult> {
  try {
    const bars = await fetchDaily(ticker);
    if (bars.length === 0) throw new Error("no bars returned");
    await upsertBars(ticker, bars);

    const ind = computeIndicators(bars);
    const from = Math.max(0, bars.length - SIGNAL_DAYS - 1);
    const sigs: Signal[] = [];
    for (let i = from; i < bars.length; i++) {
      const s = signalAt(bars, ind, i);
      if (s) sigs.push(s);
    }
    const rows = sigs.map((s, j) => ({ ...s, changed: j > 0 && sigs[j - 1].action !== s.action }));
    await saveSignals(ticker, rows.slice(1)); // first one only seeds the "changed" comparison

    const last = rows[rows.length - 1];
    const prev = rows.length > 1 ? rows[rows.length - 2] : null;
    return {
      ticker,
      ok: true,
      bars: bars.length,
      latest: last && {
        date: last.date,
        action: last.action,
        score: last.score,
        changed: last.changed,
        previous: prev?.action ?? null,
      },
    };
  } catch (e) {
    return { ticker, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ingestAll(): Promise<IngestResult[]> {
  const list = await getWatchlist();
  const results: IngestResult[] = [];
  // Sequential with a small gap to stay friendly with free-tier rate limits
  for (const { ticker } of list) {
    results.push(await ingestTicker(ticker));
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}
