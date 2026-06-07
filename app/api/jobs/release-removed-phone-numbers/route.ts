import { NextRequest } from "next/server";

import { getPhoneNumberReleaseCronSecret } from "@/lib/env";
import {
  listDuePhoneNumberReleases,
  markPhoneNumberReleased,
  markPhoneNumberReleaseFailed,
} from "@/lib/db/clinic-phone-numbers";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { logger } from "@/lib/logging/logger";
import { releaseIncomingPhoneNumber } from "@/lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return runReleaseJob(req);
}

export async function POST(req: NextRequest) {
  return runReleaseJob(req);
}

async function runReleaseJob(req: NextRequest) {
  if (!isAuthorized(req)) {
    return jsonError(401, "unauthorized", "Unauthorized");
  }

  const rows = await listDuePhoneNumberReleases(25);
  let released = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.twilio_phone_number_sid) {
      await markPhoneNumberReleased(row.id);
      released += 1;
      continue;
    }

    try {
      await releaseIncomingPhoneNumber(row.twilio_phone_number_sid);
      await markPhoneNumberReleased(row.id);
      released += 1;
      logger.info("phone_number.release_job.released", {
        clinicId: row.clinic_id,
        phoneNumberId: row.id,
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "unknown";
      await markPhoneNumberReleaseFailed(row.id, message);
      logger.error("phone_number.release_job.failed", {
        clinicId: row.clinic_id,
        phoneNumberId: row.id,
        message,
      });
    }
  }

  return jsonOk({ ok: true, checked: rows.length, released, failed, skipped });
}

function isAuthorized(req: NextRequest): boolean {
  let secret: string;
  try {
    secret = getPhoneNumberReleaseCronSecret();
  } catch {
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
