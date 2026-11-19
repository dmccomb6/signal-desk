import "server-only";
import { db, SCHEMA } from "./db";

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: string; code?: string; hint?: string };
    return [o.code, o.message, o.hint].filter(Boolean).join(" - ") || JSON.stringify(e);
  }
  return String(e);
}

/** Maps common Supabase/PostgREST errors to the setup step that fixes them */
export function fixFor(message: string): string | undefined {
  if (message.includes("PGRST106") || message.toLowerCase().includes("schema must be one of")) {
    return `Supabase -> Integrations -> Data API -> Settings: add "${SCHEMA}" to Exposed schemas and save.`;
  }
  if (message.includes("42501") || message.toLowerCase().includes("permission denied")) {
    return "Run the GRANT statements at the bottom of supabase/schema.sql in the SQL editor.";
  }
  if (message.includes("PGRST205") || message.includes("42P01") || message.toLowerCase().includes("could not find the table")) {
    return "Run supabase/schema.sql in the Supabase SQL editor (tables don't exist yet). If you just ran it, wait a few seconds for the API schema cache to reload.";
  }
  if (message.toLowerCase().includes("env vars missing")) {
    return "Check Vercel -> Settings -> Environment Variables for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), then redeploy.";
  }
  if (message.toLowerCase().includes("invalid api key") || message.includes("401")) {
    return "The Supabase key is wrong or from another project - re-check the service role / secret key and redeploy.";
  }
  return undefined;
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const env = (k: string) => !!process.env[k];
  const checks: HealthCheck[] = [
    {
      name: "Supabase URL",
      ok: env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL"),
      detail: env("SUPABASE_URL") ? "SUPABASE_URL" : env("NEXT_PUBLIC_SUPABASE_URL") ? "NEXT_PUBLIC_SUPABASE_URL" : "not set",
    },
    {
      name: "Supabase server key",
      ok: env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY"),
      detail: env("SUPABASE_SERVICE_ROLE_KEY")
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : env("SUPABASE_SECRET_KEY")
          ? "SUPABASE_SECRET_KEY"
          : "not set",
    },
    { name: "CRON_SECRET", ok: env("CRON_SECRET"), detail: env("CRON_SECRET") ? "set" : "not set" },
    { name: "APP_PASSCODE", ok: env("APP_PASSCODE"), detail: env("APP_PASSCODE") ? "set" : "not set" },
    { name: "Schema", ok: true, detail: SCHEMA },
  ];
  for (const c of checks) {
    if (!c.ok) c.fix = `Add ${c.name} in Vercel -> Settings -> Environment Variables, then redeploy.`;
  }

  for (const table of ["watchlist", "prices", "signals"]) {
    try {
      const { count, error } = await db().from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      checks.push({ name: `Table ${SCHEMA}.${table}`, ok: true, detail: `${count ?? 0} rows` });
    } catch (e) {
      const msg = errorMessage(e);
      checks.push({ name: `Table ${SCHEMA}.${table}`, ok: false, detail: msg, fix: fixFor(msg) });
    }
  }
  return checks;
}
