import { NextResponse, type NextRequest } from "next/server";
import { ingestAll, ingestTicker } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
// Run it manually: curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ingest
// Single ticker:   .../api/cron/ingest?ticker=AAPL
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker");
  const results = ticker ? [await ingestTicker(ticker.toUpperCase())] : await ingestAll();
  const changes = results.filter((r) => r.latest?.changed);

  return NextResponse.json({
    ran: new Date().toISOString(),
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    changes: changes.map((r) => `${r.ticker}: ${r.latest!.previous} -> ${r.latest!.action}`),
    results,
  });
}
