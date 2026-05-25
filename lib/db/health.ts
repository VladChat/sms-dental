import { getDb, isDatabaseConfigured } from "./client";

export type DbHealthResult =
  | { configured: false; ok: false }
  | { configured: true; ok: true; latencyMs: number }
  | { configured: true; ok: false; latencyMs: number; errorCode: string };

// Safe SELECT 1 health check. Never throws. Never returns connection details.
export async function checkDbHealth(): Promise<DbHealthResult> {
  if (!isDatabaseConfigured()) {
    return { configured: false, ok: false };
  }
  const started = Date.now();
  try {
    const sql = getDb();
    await sql`select 1 as ok`;
    return { configured: true, ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    const errorCode =
      err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
        ? (err as { code: string }).code
        : "unknown";
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - started,
      errorCode,
    };
  }
}
