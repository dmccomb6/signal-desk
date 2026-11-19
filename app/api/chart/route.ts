import { NextResponse, type NextRequest } from "next/server";
import { getChartData, RANGES, type ChartRange } from "@/lib/chart";
import { errorMessage } from "@/lib/health";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/;

// GET /api/chart?ticker=NVDA&range=1D|1W|30D
export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").toUpperCase();
  const range = (req.nextUrl.searchParams.get("range") ?? "1D").toUpperCase() as ChartRange;
  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: "bad ticker" }, { status: 400 });
  if (!RANGES.includes(range)) return NextResponse.json({ error: "bad range" }, { status: 400 });

  try {
    const data = await getChartData(ticker, range);
    return NextResponse.json(data, {
      // Let Vercel's CDN serve repeat requests for 5 minutes
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }
}
