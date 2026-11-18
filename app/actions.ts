"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addTicker, removeTicker } from "@/lib/db";
import { ingestTicker } from "@/lib/ingest";

export interface FormState {
  message: string;
  ok: boolean;
}

function checkPasscode(form: FormData): boolean {
  const expected = process.env.APP_PASSCODE;
  return !!expected && form.get("passcode") === expected;
}

const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/;

export async function addTickerAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!checkPasscode(form)) return { ok: false, message: "Wrong passcode" };
  const ticker = String(form.get("ticker") ?? "").trim().toUpperCase();
  const name = String(form.get("name") ?? "").trim() || null;
  if (!TICKER_RE.test(ticker)) return { ok: false, message: "That doesn't look like a ticker" };

  await addTicker(ticker, name);
  const result = await ingestTicker(ticker);
  if (!result.ok) {
    await removeTicker(ticker);
    return { ok: false, message: `Couldn't fetch ${ticker}: ${result.error}` };
  }
  revalidatePath("/");
  return { ok: true, message: `Added ${ticker} (${result.bars} days of history)` };
}

export async function removeTickerAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!checkPasscode(form)) return { ok: false, message: "Wrong passcode" };
  const ticker = String(form.get("ticker") ?? "").trim().toUpperCase();
  await removeTicker(ticker);
  revalidatePath("/");
  redirect("/");
}
