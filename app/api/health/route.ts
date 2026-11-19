import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

// Reports which env vars are present (never their values) and whether each table is reachable.
export async function GET() {
  const checks = await runHealthChecks();
  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
