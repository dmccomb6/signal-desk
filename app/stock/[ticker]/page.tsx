import Link from "next/link";
import { notFound } from "next/navigation";
import EquityChart from "@/components/EquityChart";
import PriceChart from "@/components/PriceChart";
import { ActionBadge, Pct, ScoreBar } from "@/components/bits";
import { RemoveTickerForm } from "@/components/WatchlistForms";
import { backtest } from "@/lib/backtest";
import { getBars, getSignalHistory, getWatchlist } from "@/lib/db";
import { CONFIG, computeIndicators, signalAt } from "@/lib/signals";

export const dynamic = "force-dynamic";

const WINDOW = 30;

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const ticker = decodeURIComponent(raw).toUpperCase();

  const watch = (await getWatchlist()).find((w) => w.ticker === ticker);
  if (!watch) notFound();

  const [bars, history] = await Promise.all([getBars(ticker), getSignalHistory(ticker, WINDOW)]);
  if (bars.length < 40) {
    return (
      <div className="panel empty">
        Not enough price history for {ticker} yet. Run the ingest job, then refresh.
      </div>
    );
  }

  const ind = computeIndicators(bars);
  const latest = signalAt(bars, ind, bars.length - 1)!;
  const start = bars.length - WINDOW;
  const view = <T,>(xs: T[]) => xs.slice(start);
  const windowBars = view(bars);
  const markers = history.filter((h) => h.changed).map((h) => ({ date: h.date, action: h.action }));

  // Backtest over the last ~12 months of stored history
  const bt = backtest(bars.slice(-252 - 35));
  const beat = bt ? bt.strategyReturnPct - bt.buyHoldReturnPct : 0;

  const last = bars[bars.length - 1];
  const change30 = (last.close / bars[start - 1].close - 1) * 100;
  const hi30 = Math.max(...windowBars.map((b) => b.high));
  const lo30 = Math.min(...windowBars.map((b) => b.low));
  const r = ind.rsi[bars.length - 1];
  const vr = ind.volRatio[bars.length - 1];

  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <Link href="/" className="muted small">&larr; Watchlist</Link>
          <h1 style={{ marginTop: 6 }}>
            {ticker} {watch.name && <span className="muted" style={{ fontWeight: 400 }}>{watch.name}</span>}
          </h1>
          <div className="row">
            <span className="mono" style={{ fontSize: 22 }}>{last.close.toFixed(2)}</span>
            <Pct value={change30} /> <span className="muted small">over 30 trading days, close {last.date}</span>
          </div>
        </div>
        <div className="row">
          <ActionBadge action={latest.action} />
          <ScoreBar score={latest.score} />
          <span className="muted small">confidence {(latest.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat"><div className="label">30d range</div><div className="mono">{lo30.toFixed(2)} - {hi30.toFixed(2)}</div></div>
        <div className="stat"><div className="label">RSI (14)</div><div className="mono">{Number.isFinite(r) ? r.toFixed(1) : "-"}</div></div>
        <div className="stat"><div className="label">Volume vs 20d avg</div><div className="mono">{Number.isFinite(vr) ? `${vr.toFixed(2)}x` : "-"}</div></div>
        <div className="stat"><div className="label">30d trend</div><div className="mono">{ind.slope[bars.length - 1]?.toFixed(2)}% / day</div></div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Last {WINDOW} trading days</h2>
          <PriceChart
            bars={windowBars}
            fast={view(ind.fast)}
            slow={view(ind.slow)}
            upper={view(ind.bands.upper)}
            lower={view(ind.bands.lower)}
            volRatio={view(ind.volRatio)}
            markers={markers}
            spikeThreshold={CONFIG.volumeSpike}
          />
        </div>

        <div className="panel">
          <h2>Why {latest.action}?</h2>
          <ul className="reasons">
            {latest.reasons.map((x) => (
              <li key={x.key}>
                <span>{x.label}</span>
                <span className={`mono ${x.points >= 0 ? "up" : "down"}`}>
                  {x.points > 0 ? "+" : ""}
                  {x.points}
                </span>
              </li>
            ))}
            {latest.reasons.length === 0 && <li className="muted">No signals firing - neutral.</li>}
          </ul>
          {latest.outliers.length > 0 && (
            <>
              <h2 style={{ marginTop: 18 }}>Outliers</h2>
              <div className="row">
                {latest.outliers.map((o) => <span key={o.key} className="chip warn">{o.label}</span>)}
              </div>
            </>
          )}
          <p className="muted small" style={{ marginTop: 18 }}>
            BUY at score ≥ {CONFIG.buyThreshold}, SELL at ≤ {CONFIG.sellThreshold}. Tune the rules in{" "}
            <code>lib/signals.ts</code>.
          </p>
        </div>
      </div>

      {bt && (
        <div className="panel">
          <div className="row spread">
            <h2>Backtest: would these rules have worked?</h2>
            <span className="muted small">{bt.startDate} to {bt.endDate}, 0.1% fee per trade, long only</span>
          </div>
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="label">Strategy</div><div className="value"><Pct value={bt.strategyReturnPct} /></div></div>
            <div className="stat"><div className="label">Buy &amp; hold</div><div className="value"><Pct value={bt.buyHoldReturnPct} /></div></div>
            <div className="stat"><div className="label">Max drawdown</div><div className="value mono down">{bt.maxDrawdownPct.toFixed(1)}%</div><div className="muted small">B&amp;H {bt.buyHoldMaxDrawdownPct.toFixed(1)}%</div></div>
            <div className="stat"><div className="label">Trades / win rate</div><div className="value mono">{bt.trades.length} / {bt.winRatePct.toFixed(0)}%</div><div className="muted small">in market {bt.daysInMarketPct.toFixed(0)}% of days</div></div>
          </div>
          <EquityChart equity={bt.equity} />
          <p className={`small ${beat >= 0 ? "up" : "down"}`}>
            {beat >= 0
              ? `Rules beat buy & hold by ${beat.toFixed(1)} points on this stock over this period - still check it isn't luck.`
              : `Rules lagged buy & hold by ${Math.abs(beat).toFixed(1)} points - treat this stock's signals with suspicion.`}
          </p>
          {bt.trades.length > 0 && (
            <details>
              <summary className="muted small" style={{ cursor: "pointer" }}>Trade log</summary>
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Entry</th><th className="num">Price</th><th>Exit</th><th className="num">Price</th><th className="num">Return</th></tr></thead>
                <tbody>
                  {bt.trades.map((t) => (
                    <tr key={t.entryDate}>
                      <td>{t.entryDate}</td>
                      <td className="num mono">{t.entryPrice.toFixed(2)}</td>
                      <td>{t.open ? <span className="chip">open</span> : t.exitDate}</td>
                      <td className="num mono">{t.exitPrice?.toFixed(2) ?? "-"}</td>
                      <td className="num"><Pct value={t.returnPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      <div className="panel">
        <h2>Signal history</h2>
        <table>
          <thead><tr><th>Date</th><th className="num">Close</th><th>Score</th><th>Signal</th><th>Main driver</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.date}>
                <td>{h.date}</td>
                <td className="num mono">{h.close.toFixed(2)}</td>
                <td><ScoreBar score={h.score} /></td>
                <td><ActionBadge action={h.action} isNew={h.changed} /></td>
                <td className="small muted">{h.reasons[0]?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <RemoveTickerForm ticker={ticker} />
      </div>
    </div>
  );
}
