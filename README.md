# Signal Desk

A personal stock watchlist that pulls daily prices after the market closes, runs a set of technical rules over them, and gives each stock a **BUY / HOLD / SELL** score with the reasons behind it. Every stock page also backtests those same rules against simply buying and holding, so you can see whether the signals would have helped.

> This is a rules engine for learning and research, not financial advice. Technical signals on their own are weak predictors, and the backtest is there to keep the rules honest.

## How it works

```
Vercel Cron (22:30 UTC, Mon-Fri)
   -> /api/cron/ingest
      -> fetch ~2 years of daily OHLCV per ticker (Yahoo or Alpha Vantage)
      -> upsert into Supabase `prices`
      -> compute indicators -> score last 30 days -> upsert `signals`
Dashboard (server components) reads Supabase and recomputes charts + backtest on the fly
```

### The scoring rules (`lib/signals.ts`)

| Signal | Points |
| --- | --- |
| 5-day average above / below 20-day average | +20 / -20 |
| Fresh moving-average crossover (last 3 days) | +10 / -10 |
| 30-day regression slope (scaled) | up to ±15 |
| RSI below 30 (oversold) / above 70 (overbought) | +20 / -20 |
| MACD cross, or building / fading momentum | ±15 / ±8 |
| Close outside the Bollinger bands | +15 below / -15 above |
| Volume ≥ 2× the 20-day average, in the day's direction | ±10 |
| Daily move ≥ 2.5σ | flagged as an outlier, not scored |

A score of **≥ 30 is a BUY** and **≤ -30 is a SELL**. Confidence is the share of signal weight that agrees with the score. All the thresholds are in `CONFIG`.

### The backtest (`lib/backtest.ts`)

This is a long-only replay over roughly the last 12 months. A signal on day *i* trades at day *i+1*'s open, so the backtest can't see the future. It charges a 0.1% fee per side and reports the strategy's return, the buy-and-hold return, max drawdown, win rate and time in the market.

## Setup

1. **Supabase:** in a new or existing project, open the SQL editor and run `supabase/schema.sql`. This creates a separate `signal_desk` schema with the tables and a starter watchlist, so it can share a project with your other apps. Then go to **Integrations -> Data API -> Settings** and add `signal_desk` to **Exposed schemas**.
2. **Env vars:** if Supabase is connected through the Vercel integration, the Supabase URL and keys are already set. Add `CRON_SECRET`, `APP_PASSCODE` and `SUPABASE_SCHEMA=signal_desk` in Vercel under Project -> Settings -> Environment Variables, then run `vercel env pull .env.local` for local dev. Otherwise, copy `.env.example` to `.env.local` and fill it in.
3. **Run locally:** run `npm install`, then `npm run dev`.
4. **First data load:** with the dev server running:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ingest
   ```
5. **Deploy:** import the repo into Vercel. The cron in `vercel.json` runs once each weekday after the US close, which fits the Hobby plan's once-a-day limit.

## Data providers

- **`yahoo` (default):** no key needed, about 2 years of history, and London tickers via `.L` (e.g. `BARC.L`). It's an unofficial endpoint, so it can rate-limit or change without warning.
- **`alphavantage`:** needs a free key. The free tier allows 25 requests a day and returns about 100 days of history, which is enough for signals but gives a shorter backtest.

## Ideas for next steps

- Email or push alerts when a signal changes (the ingest response already lists `changes`)
- A parameter sweep page that backtests different thresholds side by side
- Pull news sentiment in as an extra signal
- Paper-trading portfolio that follows the signals forward in time
