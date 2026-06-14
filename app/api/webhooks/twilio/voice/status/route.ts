import { NextRequest } from "next/server";
import { twimlResponse, jsonForbidden } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone/normalize";
import { lookupClinicByPhoneIncludingScheduled } from "@/lib/db/clinics";
import { getOrCreateConversation } from "@/lib/db/conversations";
import { hasAiVoiceRuntimeSessionForCall } from "@/lib/db/ai-voice-runtime-sessions";
import { sendRecoverySms } from "@/lib/twilio/outbound-sms";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio voice call status callback. Fires after the call ends.
// SMS recovery is sent here, not in voice/incoming, so the caller hears the
// full greeting before any text arrives on their phone.
export async function POST(request: NextRequest) {
  const url = reconstructTwilioWebhookUrl(request);
  const params = await readTwilioFormPayload(request);
  const signatureHeader = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature({ signatureHeader, url, params })) {
    logger.warn("twilio.voice.status.signature_invalid", {
      url,
      hasSignature: !!signatureHeader,
    });
    return jsonForbidden("Invalid Twilio signature");
  }

  const callSid = params.CallSid ?? "";
  const callStatus = params.CallStatus ?? "";

  // Only act on completed calls. Other statuses (initiated, ringing, answered,
  // busy, no-answer, failed) are silently acknowledged so Twilio does not retry.
  if (callStatus !== "completed") {
    return twimlResponse();
  }

  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);

  if (!isDatabaseConfigured() || !callSid) {
    logger.info("twilio.voice.status.skipped", {
      reason: !isDatabaseConfigured() ? "db_not_configured" : "no_call_sid",
    });
    return twimlResponse();
  }

  // Idempotent record. Uses a distinct externalId from the ringing event
  // (voice:${callSid}) so Twilio retries of the status callback are deduplicated
  // without blocking SMS delivery.
  let isDuplicate = false;
  try {
    const result = await recordWebhookEvent({
      provider: "twilio",
      eventType: "voice.completed",
      externalId: `voice:status:${callSid}`,
      payload: params,
    });
    isDuplicate = result.recorded && result.duplicate;
  } catch (err) {
    logger.error("twilio.voice.status.persist_failed", {
      callSid,
      message: err instanceof Error ? err.message : "unknown",
    });
    // Non-fatal: still proceed with SMS attempt so a DB hiccup on the
    // webhook_events write doesn't silently drop the recovery text.
  }

  if (isDuplicate) {
    logger.info("twilio.voice.status.duplicate", { callSid });
    return twimlResponse();
  }

  // Look up clinic and attempt recovery SMS with all guards enforced.
  try {
    const routing = await lookupClinicByPhoneIncludingScheduled(to);

    // A number scheduled for removal must never trigger recovery SMS. The
    // active-only routing rule below would already skip it, but skip explicitly
    // with a clear reason so the suppression is observable.
    if (routing && routing.removalStatus === "scheduled") {
      logger.info("twilio.voice.status.scheduled_skip", { to });
      return twimlResponse();
    }

    const clinic = routing && routing.removalStatus === "active" ? routing.clinic : null;
    if (!clinic) {
      logger.info("twilio.voice.status.no_clinic_mapping", { to });
      return twimlResponse();
    }

    if (!from) {
      logger.info("twilio.voice.status.no_from_number", { callSid });
      return twimlResponse();
    }

    // AI-answered calls capture the request through the relay; they must NOT
    // also receive a missed-call recovery SMS. DB-only check (no provider call,
    // no SMS). Existing behavior is unchanged for normal missed calls (no
    // future_twilio session exists, so this is false).
    const hasAiSession = await hasAiVoiceRuntimeSessionForCall({
      clinicId: clinic.id,
      callSid,
    });
    if (hasAiSession) {
      logger.info("twilio.voice.status.ai_answering_session_present", { callSid });
      return twimlResponse();
    }

    const { id: conversationId } = await getOrCreateConversation(
      clinic.id,
      from,
    );

    const smsResult = await sendRecoverySms({
      clinic,
      patientPhone: from,
      twilioPhone: to,
      conversationId,
    });

    if (!smsResult.sent) {
      logger.info("twilio.voice.status.sms_skipped", {
        callSid,
        reason: smsResult.reason,
      });
    }
  } catch (err) {
    logger.error("twilio.voice.status.sms_failed", {
      callSid,
      message: err instanceof Error ? err.message : "unknown",
    });
    // Never surface errors to Twilio — always return 200 so it does not retry.
  }

  return twimlResponse();
}
