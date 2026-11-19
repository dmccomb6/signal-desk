import Link from "next/link";
import { ActionBadge, Pct, ScoreBar, Sparkline } from "@/components/bits";
import HomeCharts from "@/components/HomeCharts";
import { AddTickerForm } from "@/components/WatchlistForms";
import SetupPanel from "@/components/SetupPanel";
import { getBars, getLatestSignals, getWatchlist } from "@/lib/db";
import { errorMessage, runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

const WINDOW = 30;

async function loadRows() {
  const [watchlist, signals] = await Promise.all([getWatchlist(), getLatestSignals()]);
  const sigMap = new Map(signals.map((s) => [s.ticker, s]));
  const rows = await Promise.all(
    watchlist.map(async (w) => {
      const bars = await getBars(w.ticker, WINDOW + 1);
      const closes = bars.map((b) => b.close);
      const change = closes.length > 1 ? (closes[closes.length - 1] / closes[0] - 1) * 100 : NaN;
      return { ...w, closes: closes.slice(-WINDOW), change, signal: sigMap.get(w.ticker) };
    }),
  );
  return { rows, signals };
}

export default async function Home() {
  let data: Awaited<ReturnType<typeof loadRows>>;
  try {
    data = await loadRows();
  } catch (e) {
    const message = errorMessage(e);
    console.error("[home] failed to load:", message);
    return <SetupPanel error={message} checks={await runHealthChecks()} />;
  }
  const { rows, signals } = data;
  rows.sort((a, b) => (b.signal?.score ?? -999) - (a.signal?.score ?? -999));

  const count = (a: string) => rows.filter((r) => r.signal?.action === a).length;
  const lastRun = signals.map((s) => s.date).sort().pop();

  return (
    <div>
      <div className="row spread">
        <div>
          <h1>Watchlist</h1>
          <div className="muted small">
            {lastRun ? `Signals as of market close ${lastRun}` : "No signals yet - run the ingest job (see README)"}
          </div>
        </div>
      </div>

      <div className="summary">
        <div className="stat"><div className="label">Buy signals</div><div className="value up">{count("BUY")}</div></div>
        <div className="stat"><div className="label">Hold</div><div className="value" style={{ color: "var(--hold)" }}>{count("HOLD")}</div></div>
        <div className="stat"><div className="label">Sell signals</div><div className="value down">{count("SELL")}</div></div>
      </div>

      <HomeCharts stocks={rows.map((r) => ({ ticker: r.ticker, name: r.name }))} />

      <h2>Signals</h2>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="num">Close</th>
              <th className="num">30d</th>
              <th>30-day trend</th>
              <th>Score</th>
              <th>Signal</th>
              <th>Top reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="link-row">
                <td>
                  <Link href={`/stock/${encodeURIComponent(r.ticker)}`}>
                    <strong>{r.ticker}</strong>
                    {r.name && <div className="muted small">{r.name}</div>}
                  </Link>
                </td>
                <td className="num mono">{r.closes.length ? r.closes[r.closes.length - 1].toFixed(2) : "-"}</td>
                <td className="num"><Pct value={r.change} /></td>
                <td><Sparkline values={r.closes} /></td>
                <td>{r.signal ? <ScoreBar score={r.signal.score} /> : <span className="muted">-</span>}</td>
                <td>{r.signal ? <ActionBadge action={r.signal.action} isNew={r.signal.changed} /> : <span className="muted">-</span>}</td>
                <td className="small muted">
                  {r.signal?.reasons[0]?.label ?? ""}
                  {r.signal?.outliers.length ? <span className="chip warn" style={{ marginLeft: 6 }}>outlier</span> : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">Watchlist is empty - add a ticker below.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Add a stock</h2>
        <AddTickerForm />
        <p className="muted small" style={{ marginBottom: 0 }}>
          London listings use the Yahoo suffix <code>.L</code> (e.g. <code>BARC.L</code>). Prices are in the listing
          currency - pence for most LSE stocks.
        </p>
      </div>
    </div>
  );
}
