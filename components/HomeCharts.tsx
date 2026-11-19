"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChartRange } from "@/lib/chart-types";
import RangeChart, { RangeToggle } from "./RangeChart";

export default function HomeCharts({ stocks }: { stocks: { ticker: string; name: string | null }[] }) {
  const [range, setRange] = useState<ChartRange>("1D");
  if (stocks.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 12, marginBottom: 20 }}>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Price</h2>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      <div className="chart-grid">
        {stocks.map((s) => (
          <div key={s.ticker} className="panel">
            <Link href={`/stock/${encodeURIComponent(s.ticker)}`} className="row" style={{ gap: 8, marginBottom: 6 }}>
              <strong>{s.ticker}</strong>
              {s.name && <span className="muted small">{s.name}</span>}
            </Link>
            <RangeChart ticker={s.ticker} range={range} height={150} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
