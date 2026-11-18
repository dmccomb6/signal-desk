import type { Bar } from "../types";
import { fetchAlphaVantageDaily } from "./alphavantage";
import { fetchYahooDaily } from "./yahoo";

export function providerName(): string {
  return process.env.DATA_PROVIDER === "alphavantage" ? "alphavantage" : "yahoo";
}

export async function fetchDaily(ticker: string): Promise<Bar[]> {
  return providerName() === "alphavantage" ? fetchAlphaVantageDaily(ticker) : fetchYahooDaily(ticker);
}
