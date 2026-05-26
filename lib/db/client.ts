import postgres, { type Sql } from "postgres";

// Lazy Postgres client backed by the `postgres` (postgres.js) driver.
//
// Why postgres.js and not @supabase/supabase-js:
// - We control schema and queries directly via SQL migrations.
// - SUPABASE_DB_URL is the canonical env var in this repo.
// - postgres.js is small, fast, and works well with Supabase pooler URLs.
//
// The client is created on first call and reused. It does not open a TCP
// connection at module import time, so `next build` never needs DB access.
// prepare:false is required for Supabase's transaction-mode pooler (port 6543)
// and is safe for direct connections too.

let cachedClient: Sql | undefined;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_DB_URL is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured(): boolean {
  const url = process.env.SUPABASE_DB_URL;
  return typeof url === "string" && url.length > 0;
}

export function getDb(): Sql {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  cachedClient = postgres(url, {
    ssl: "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return cachedClient;
}

// Test-only / process-shutdown helper. Not exported from a public surface.
export async function closeDb(): Promise<void> {
  if (cachedClient) {
    const c = cachedClient;
    cachedClient = undefined;
    await c.end({ timeout: 5 });
  }
}
