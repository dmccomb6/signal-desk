import { computeIndicators, signalAt, WARMUP } from "./signals";
import type { Bar } from "./types";

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  returnPct: number; // net of fees; open trades marked to last close
  open: boolean;
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  strategyReturnPct: number;
  buyHoldReturnPct: number;
  maxDrawdownPct: number;
  buyHoldMaxDrawdownPct: number;
  trades: Trade[];
  winRatePct: number;
  daysInMarketPct: number;
  equity: { date: string; strategy: number; buyHold: number }[];
}

/**
 * Long-only replay. A BUY signal on day i buys at day i+1's open; a SELL signal
 * exits at day i+1's open. HOLD changes nothing. Fees in basis points per side.
 */
export function backtest(bars: Bar[], feeBps = 10): BacktestResult | null {
  if (bars.length < WARMUP + 10) return null;
  const ind = computeIndicators(bars);
  const fee = feeBps / 10_000;
  const start = WARMUP - 1;

  let cash = 1;
  let shares = 0;
  let pending: "BUY" | "SELL" | null = null;
  let entry: { date: string; price: number; cost: number } | null = null;
  const trades: Trade[] = [];
  const equity: BacktestResult["equity"] = [];
  const bhShares = 1 / bars[start].close;
  let daysIn = 0;

  for (let i = start; i < bars.length; i++) {
    const bar = bars[i];

    // Execute yesterday's decision at today's open
    if (pending === "BUY" && shares === 0) {
      shares = (cash * (1 - fee)) / bar.open;
      entry = { date: bar.date, price: bar.open, cost: cash };
      cash = 0;
    } else if (pending === "SELL" && shares > 0 && entry) {
      cash = shares * bar.open * (1 - fee);
      trades.push({
        entryDate: entry.date,
        entryPrice: entry.price,
        exitDate: bar.date,
        exitPrice: bar.open,
        returnPct: (cash / entry.cost - 1) * 100,
        open: false,
      });
      shares = 0;
      entry = null;
    }
    pending = null;

    if (shares > 0) daysIn++;
    equity.push({ date: bar.date, strategy: cash + shares * bar.close, buyHold: bhShares * bar.close });

    const sig = signalAt(bars, ind, i);
    if (sig && i < bars.length - 1) {
      if (sig.action === "BUY" && shares === 0) pending = "BUY";
      if (sig.action === "SELL" && shares > 0) pending = "SELL";
    }
  }

  const last = bars[bars.length - 1];
  if (shares > 0 && entry) {
    trades.push({
      entryDate: entry.date,
      entryPrice: entry.price,
      exitDate: null,
      exitPrice: null,
      returnPct: ((shares * last.close) / entry.cost - 1) * 100,
      open: true,
    });
  }

  const finalEq = equity[equity.length - 1];
  const closed = trades.filter((t) => !t.open);
  return {
    startDate: bars[start].date,
    endDate: last.date,
    strategyReturnPct: (finalEq.strategy - 1) * 100,
    buyHoldReturnPct: (finalEq.buyHold - 1) * 100,
    maxDrawdownPct: maxDrawdown(equity.map((e) => e.strategy)),
    buyHoldMaxDrawdownPct: maxDrawdown(equity.map((e) => e.buyHold)),
    trades,
    winRatePct: closed.length ? (closed.filter((t) => t.returnPct > 0).length / closed.length) * 100 : 0,
    daysInMarketPct: (daysIn / equity.length) * 100,
    equity,
  };
}

function maxDrawdown(series: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of series) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst * 100;
}
