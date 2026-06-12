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
import { getClinicConversationConfig } from "@/lib/db/sms-conversation-settings";
import { evaluateSmsReadinessForLiveSend } from "@/lib/db/sms-readiness";
import {
  evaluateDuplicateSuppression,
  evaluateRecoverySendGate,
} from "@/lib/sms-recovery/live-send-evaluation";
import { getDuplicateSuppressionWindowMs } from "@/lib/sms-recovery/templates";
import {
  buildInactiveNumberVoiceTwiml,
  buildMissedCallVoiceTwiml,
  type VoiceGreetingPrediction,
} from "@/lib/sms-recovery/voice-twiml";
import type { VoiceGreetingTemplateConfig } from "@/lib/sms-recovery/voice-greeting-templates";
import { getSmsRecoveryConfig } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prediction for which greeting to play. Read-only — never sends SMS.
// Mirrors the guard logic in sendRecoverySms() so the greeting matches
// what voice/status will do after the call ends.
async function predictGreeting(
  from: string,
  to: string,
  clinic: ClinicRow,
): Promise<VoiceGreetingPrediction> {
  const config = getSmsRecoveryConfig();

  // Mirror the guard sequence in sendRecoverySms (read-only) through the SAME
  // shared gate decision, so the greeting matches what voice/status will do.
  // Exact-number readiness applies in BOTH owner_test and live mode.
  if (config.mode !== "owner_test" && config.mode !== "live") {
    return "none"; // disabled
  }
  const readiness = await evaluateSmsReadinessForLiveSend(clinic.id, to);
  const gate = evaluateRecoverySendGate({
    mode: config.mode,
    allowedTestNumbers: config.allowedNumbers,
    patientPhone: from,
    clinicSmsRecoveryEnabled: clinic.sms_recovery_enabled,
    clinicSmsStatus: clinic.sms_status,
    numberReadiness: readiness,
  });
  if (!gate.ok) return "none";

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
  const duplicateDecision = evaluateDuplicateSuppression({
    patientPhone: from,
    alreadySent,
    bypassNumbers: config.duplicateSuppressionBypassNumbers,
  });
  return duplicateDecision.ok ? "will_send" : "duplicate";
}

// Greeting for a number scheduled for removal. The number is still held by our
// Twilio account (so Twilio still calls this webhook) but no longer routes to the
// clinic and must never trigger recovery SMS. Play a short inactive-line notice
// and hang up.
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
  let prediction: VoiceGreetingPrediction = "none";
  let clinicNameForTwiml: string | null = null;
  let voiceGreetings: VoiceGreetingTemplateConfig | null = null;

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
        return twimlResponse(buildInactiveNumberVoiceTwiml());
      }

      const clinic = routing && routing.removalStatus === "active" ? routing.clinic : null;
      if (clinic && from) {
        clinicNameForTwiml = clinic.name;
        try {
          voiceGreetings = (await getClinicConversationConfig(clinic.id)).voiceGreetings;
        } catch (err) {
          logger.warn("twilio.voice.greeting_config_failed", {
            callSid,
            message: err instanceof Error ? err.message : "unknown",
          });
        }
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

  return twimlResponse(buildMissedCallVoiceTwiml(clinicNameForTwiml, prediction, voiceGreetings));
}
