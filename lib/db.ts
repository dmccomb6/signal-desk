import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bar, Signal, SignalRow } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any, any, any> | null = null;

/** Tables live in their own schema so the project can be shared with other apps */
export const SCHEMA = process.env.SUPABASE_SCHEMA || "signal_desk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): SupabaseClient<any, any, any> {
  if (client) return client;
  // Accept the names the Vercel <-> Supabase integration injects, as well as manual ones
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars missing: need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  }
  client = createClient(url, key, { auth: { persistSession: false }, db: { schema: SCHEMA } });
  return client;
}

export interface WatchItem {
  ticker: string;
  name: string | null;
}

export async function getWatchlist(): Promise<WatchItem[]> {
  const { data, error } = await db().from("watchlist").select("ticker,name").order("ticker");
  if (error) throw error;
  return data ?? [];
}

export async function getBars(ticker: string, limit = 520): Promise<Bar[]> {
  const { data, error } = await db()
    .from("prices")
    .select("date,open,high,low,close,volume")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function upsertBars(ticker: string, bars: Bar[]): Promise<void> {
  const rows = bars.map((b) => ({ ticker, ...b }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("prices").upsert(rows.slice(i, i + 500), { onConflict: "ticker,date" });
    if (error) throw error;
  }
}

export async function getLatestSignals(): Promise<SignalRow[]> {
  // Latest signal per ticker: pull recent rows and keep the newest for each
  const { data, error } = await db()
    .from("signals")
    .select("*")
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const seen = new Map<string, SignalRow>();
  for (const row of (data ?? []) as SignalRow[]) if (!seen.has(row.ticker)) seen.set(row.ticker, row);
  return [...seen.values()];
}

export async function getSignalHistory(ticker: string, limit = 30): Promise<SignalRow[]> {
  const { data, error } = await db()
    .from("signals")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SignalRow[];
}

export async function saveSignals(ticker: string, rows: (Signal & { changed: boolean })[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db()
    .from("signals")
    .upsert(rows.map((r) => ({ ticker, ...r })), { onConflict: "ticker,date" });
  if (error) throw error;
}

export async function addTicker(ticker: string, name: string | null): Promise<void> {
  const { error } = await db().from("watchlist").upsert({ ticker, name }, { onConflict: "ticker" });
  if (error) throw error;
}

export async function removeTicker(ticker: string): Promise<void> {
  const { error } = await db().from("watchlist").delete().eq("ticker", ticker);
  if (error) throw error;
}
