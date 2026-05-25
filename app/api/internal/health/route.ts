import { NextRequest } from "next/server";
import { jsonOk, jsonUnauthorized } from "@/lib/http/responses";
import { getEnvPresenceReport, getInternalAdminEnv } from "@/lib/env";
import { checkDbHealth } from "@/lib/db/health";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Protected internal health probe. Reports presence of required env vars and
// a SELECT 1 DB roundtrip. Never returns secret values.
//
// Auth: caller must send `x-internal-admin-secret` matching
// INTERNAL_ADMIN_SECRET. We use a constant-time compare to avoid trivial
// timing leaks.
export async function GET(request: NextRequest) {
  const provided = request.headers.get("x-internal-admin-secret") ?? "";

  let expected: string;
  try {
    expected = getInternalAdminEnv().INTERNAL_ADMIN_SECRET;
  } catch {
    // INTERNAL_ADMIN_SECRET is not configured. Refuse rather than expose.
    return jsonUnauthorized();
  }

  if (!constantTimeEqual(provided, expected)) {
    return jsonUnauthorized();
  }

  const envPresence = getEnvPresenceReport();
  const dbHealth = await checkDbHealth();

  logger.info("internal.health.checked", {
    dbConfigured: envPresence.supabaseDbUrl,
    dbOk: "ok" in dbHealth ? dbHealth.ok : false,
  });

  return jsonOk({
    ok: true,
    service: "missed-calls-dental",
    version: "foundation-v1",
    env: envPresence,
    db: dbHealth,
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
