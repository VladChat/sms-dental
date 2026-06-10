import { NextRequest } from "next/server";

import { textingStatusSyncConfig } from "@/config/texting-status-sync.config";
import { getProtectedJobCronSecret } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { syncPhoneNumberTextingStatuses } from "@/lib/texting-status/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return runSyncJob(req);
}

export async function POST(req: NextRequest) {
  return runSyncJob(req);
}

async function runSyncJob(req: NextRequest) {
  if (!isAuthorized(req)) {
    return jsonError(401, "unauthorized", "Unauthorized");
  }

  const summary = await syncPhoneNumberTextingStatuses({
    limit: textingStatusSyncConfig.cron.batchSize,
    force: false,
  });
  return jsonOk({ ok: true, ...summary });
}

function isAuthorized(req: NextRequest): boolean {
  let secret: string;
  try {
    secret = getProtectedJobCronSecret();
  } catch {
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
