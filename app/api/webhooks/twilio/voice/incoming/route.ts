import { NextRequest } from "next/server";
import { jsonForbidden, twimlResponse } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone/normalize";
import { lookupClinicByPhone } from "@/lib/db/clinics";
import { upsertCallEvent } from "@/lib/db/call-events";
import { getOrCreateConversation } from "@/lib/db/conversations";
import { sendRecoverySms } from "@/lib/twilio/outbound-sms";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_TWIML = `<Response><Say voice="alice">Thanks for calling. We missed your call and will be in touch shortly. Goodbye.</Say><Hangup/></Response>`;

// Twilio incoming voice webhook.
//   1. Validate Twilio signature.
//   2. Record webhook_event idempotently.
//   3. Upsert call_events row keyed by CallSid.
//   4. Look up clinic by the dialed (To) number.
//   5. Get or create patient_conversation.
//   6. Attempt recovery SMS (all safety guards enforced inside sendRecoverySms).
//   7. Return polite TwiML: Say + Hangup. Always returned regardless of step 3–6.
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

  // Steps 3–6: clinic mapping, call event, conversation, SMS.
  // All wrapped in a single guard: skip if duplicate or DB not ready.
  if (!isDuplicate && isDatabaseConfigured() && callSid) {
    try {
      // Look up clinic by the Twilio number that was dialed.
      const clinic = await lookupClinicByPhone(to);

      // Upsert call_events row. Every inbound call that hits our TwiML is
      // effectively a missed call — we play a message and hang up.
      await upsertCallEvent({
        clinicId: clinic?.id ?? null,
        callSid,
        fromNumber: from,
        toNumber: to,
        callStatus,
        direction,
        isMissed: true,
        rawPayload: params,
      });

      if (clinic && from) {
        // Establish or find the conversation thread for this patient.
        const { id: conversationId } = await getOrCreateConversation(
          clinic.id,
          from,
        );

        // Attempt recovery SMS. sendRecoverySms enforces all guards:
        //   - SMS_RECOVERY_MODE must be owner_test
        //   - caller must be in SMS_TEST_ALLOWED_TO
        //   - opt-out check
        //   - 24-hour duplicate suppression
        const smsResult = await sendRecoverySms({
          clinic,
          patientPhone: from,
          twilioPhone: to,
          conversationId,
        });

        if (!smsResult.sent) {
          logger.info("twilio.voice.sms_skipped", {
            callSid,
            reason: smsResult.reason,
          });
        }
      } else if (!clinic) {
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

  return twimlResponse(VOICE_TWIML);
}
