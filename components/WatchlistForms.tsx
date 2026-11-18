"use client";

import { useActionState } from "react";
import { addTickerAction, removeTickerAction, type FormState } from "@/app/actions";

const initial: FormState = { ok: true, message: "" };

export function AddTickerForm() {
  const [state, action, pending] = useActionState(addTickerAction, initial);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <form action={action} className="inline">
        <input name="ticker" placeholder="Ticker e.g. AMZN or BARC.L" required style={{ width: 200 }} />
        <input name="name" placeholder="Name (optional)" style={{ width: 160 }} />
        <input name="passcode" type="password" placeholder="Passcode" required style={{ width: 120 }} />
        <button disabled={pending}>{pending ? "Fetching..." : "Add"}</button>
      </form>
      {state.message && <span className={`small ${state.ok ? "up" : "down"}`}>{state.message}</span>}
    </div>
  );
}

export function RemoveTickerForm({ ticker }: { ticker: string }) {
  const [state, action, pending] = useActionState(removeTickerAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="ticker" value={ticker} />
      <input name="passcode" type="password" placeholder="Passcode" required style={{ width: 120 }} />
      <button className="ghost" disabled={pending}>
        Remove {ticker}
      </button>
      {state.message && <span className={`small ${state.ok ? "up" : "down"}`}>{state.message}</span>}
    </form>
  );
}
