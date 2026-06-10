import { NextRequest } from "next/server";
import { jsonForbidden, twimlResponse } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured, getDb } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone/normalize";
import { lookupClinicByPhoneIncludingScheduled, type ClinicRow } from "@/lib/db/clinics";
import { upsertCallEvent } from "@/lib/db/call-events";
import { hasSentRecoverySmsSince } from "@/lib/db/messages";
import { evaluateSmsReadinessForLiveSend } from "@/lib/db/sms-readiness";
import { getDuplicateSuppressionWindowMs } from "@/lib/sms-recovery/templates";
import { getSmsRecoveryConfig } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Prediction for which greeting to play. Read-only — never sends SMS.
// Mirrors the guard logic in sendRecoverySms() so the greeting matches
// what voice/status will do after the call ends.
type GreetingPrediction = "will_send" | "duplicate" | "none";

async function predictGreeting(
  from: string,
  to: string,
  clinic: ClinicRow,
): Promise<GreetingPrediction> {
  const config = getSmsRecoveryConfig();

  // Mirror the guard sequence in sendRecoverySms (read-only).
  if (config.mode === "owner_test") {
    if (!config.allowedNumbers.includes(from)) return "none";
  } else if (config.mode === "live") {
    if (!clinic.sms_recovery_enabled) return "none";
    const readiness = await evaluateSmsReadinessForLiveSend(clinic.id, to);
    if (!readiness.ok) return "none";
    if (readiness.numberType === "local" && clinic.sms_status !== "active") return "none";
  } else {
    return "none"; // disabled
  }

  // Opt-out check (read-only).
  const sql = getDb();
  const optRows = await sql<{ opted_back_in_at: string | null }[]>`
    select opted_back_in_at from public.opt_outs
    where clinic_id   = ${clinic.id}
      and phone_number = ${from}
    limit 1
  `;
  if (optRows[0] && optRows[0].opted_back_in_at === null) return "none";

  // Duplicate suppression window check (read-only, same window as the sender).
  const suppressionStart = new Date(Date.now() - getDuplicateSuppressionWindowMs());
  const alreadySent = await hasSentRecoverySmsSince(clinic.id, from, suppressionStart);
  return alreadySent ? "duplicate" : "will_send";
}

function buildVoiceTwiml(
  clinicName: string | null,
  prediction: GreetingPrediction,
): string {
  const name = clinicName ? escapeXml(clinicName) : "us";
  let message: string;
  if (prediction === "will_send") {
    message = `Thanks for calling ${name}. Sorry we missed you. We'll text you now so you can request an appointment or a call back.`;
  } else if (prediction === "duplicate") {
    message = `Thanks for calling ${name}. Sorry we missed you. We already sent a text, and our team will follow up shortly.`;
  } else {
    message = `Thanks for calling ${name}. Sorry we missed you. Our team will follow up shortly.`;
  }
  return `<Response><Say voice="alice">${message}</Say><Hangup/></Response>`;
}

// Greeting for a number scheduled for removal. The number is still held by our
// Twilio account (so Twilio still calls this webhook) but no longer routes to the
// clinic and must never trigger recovery SMS. Play a short inactive-line notice
// and hang up.
function buildInactiveNumberTwiml(): string {
  return `<Response><Say voice="alice">This number is no longer in service.</Say><Hangup/></Response>`;
}

// Twilio incoming voice webhook.
//   1. Validate Twilio signature.
//   2. Record webhook_event idempotently.
//   3. Upsert call_events row.
//   4. Read-only prediction: select voice greeting based on current state.
//   5. Return TwiML quickly. No SMS is sent here.
//
// SMS recovery is handled after call completion in voice/status/route.ts.
export async function POST(request: NextRequest) {
  const url = reconstructTwilioWebhookUrl(request);
  const params = await readTwilioFormPayload(request);
  const signatureHeader = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature({ signatureHeader, url, params })) {
    logger.warn("twilio.voice.signature_invalid", {
      url,
      hasSignature: !!signatureHeader,
    });
    return jsonForbidden("Invalid Twilio signature");
  }

  const callSid = params.CallSid ?? "";
  const callStatus = params.CallStatus ?? "";
  const direction = params.Direction ?? "";
  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);

  // Step 2: idempotent webhook_events record.
  let isDuplicate = false;
  if (isDatabaseConfigured() && callSid) {
    try {
      const result = await recordWebhookEvent({
        provider: "twilio",
        eventType: `voice.${callStatus || "unknown"}`,
        externalId: `voice:${callSid}`,
        payload: params,
      });
      isDuplicate = result.recorded && result.duplicate;
    } catch (err) {
      logger.error("twilio.voice.persist_failed", {
        callSid,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  } else {
    logger.info("twilio.voice.received", {
      callSid,
      callStatus,
      direction,
      dbConfigured: isDatabaseConfigured(),
    });
  }

  // Steps 3–4: call event + read-only greeting prediction.
  let prediction: GreetingPrediction = "none";
  let clinicNameForTwiml: string | null = null;

  if (!isDuplicate && isDatabaseConfigured() && callSid) {
    try {
      // Removal-aware lookup: resolves the clinic for active AND scheduled numbers
      // so a scheduled (removal-pending) number can be detected before routing.
      const routing = await lookupClinicByPhoneIncludingScheduled(to);

      await upsertCallEvent({
        clinicId: routing?.clinic.id ?? null,
        callSid,
        fromNumber: from,
        toNumber: to,
        callStatus,
        direction,
        isMissed: true,
        rawPayload: params,
      });

      // Scheduled number: do not route to the clinic and do not predict/send
      // recovery SMS. Return the inactive-line greeting and hang up.
      if (routing && routing.removalStatus === "scheduled") {
        logger.info("twilio.voice.scheduled_number", { to });
        return twimlResponse(buildInactiveNumberTwiml());
      }

      const clinic = routing && routing.removalStatus === "active" ? routing.clinic : null;
      if (clinic && from) {
        clinicNameForTwiml = clinic.name;
        // Predict greeting based on read-only state. Non-fatal — fall back to
        // "none" if prediction fails so TwiML is always returned.
        try {
          prediction = await predictGreeting(from, to, clinic);
        } catch (err) {
          logger.warn("twilio.voice.prediction_failed", {
            callSid,
            message: err instanceof Error ? err.message : "unknown",
          });
        }
      } else if (!routing) {
        logger.info("twilio.voice.no_clinic_mapping", { to });
      }
    } catch (err) {
      logger.error("twilio.voice.mapping_failed", {
        callSid,
        message: err instanceof Error ? err.message : "unknown",
      });
      // Never surface errors to Twilio — always return TwiML.
    }
  }

  return twimlResponse(buildVoiceTwiml(clinicNameForTwiml, prediction));
}
