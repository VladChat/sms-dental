import { NextRequest } from "next/server";
import { jsonForbidden, twimlResponse } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { detectSmsKeyword } from "@/lib/twilio/keywords";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone/normalize";
import { lookupClinicByPhoneIncludingScheduled } from "@/lib/db/clinics";
import {
  getOrCreateConversation,
  setPatientDisplayNameIfEmpty,
  touchConversation,
} from "@/lib/db/conversations";
import { recordInboundMessage } from "@/lib/db/messages";
import { upsertOptOut, clearOptOut } from "@/lib/db/opt-outs";
import { classifyInboundReply } from "@/lib/sms-recovery/reply-classification";
import { maybeSendConversationAutoReply } from "@/lib/twilio/conversation-auto-reply";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio incoming SMS webhook.
//   1. Validate Twilio signature.
//   2. Detect STOP / START / HELP keyword.
//   3. Record webhook_event idempotently.
//   4. Look up clinic by To number.
//   5. Get or create patient conversation.
//   6. Record inbound message in messages table.
//   7. For STOP: write opt-out row — future recovery SMS will be blocked.
//   8. For START: clear opt-out — future recovery SMS is permitted again.
//   9. For HELP: no DB change.
//  10. For ordinary replies: classify deterministically (including the
//      safety_concern class for pain/emergency wording), optionally save a
//      safe patient name, and run the guarded auto-reply flow when eligible.
//      Name extraction runs on every ordinary inbound until a name is stored.
//  11. Return empty <Response/> for all cases — Twilio platform already sends
//      STOP/START/HELP compliance replies; returning our own <Message> caused duplicates.
export async function POST(request: NextRequest) {
  const url = reconstructTwilioWebhookUrl(request);
  const params = await readTwilioFormPayload(request);
  const signatureHeader = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature({ signatureHeader, url, params })) {
    logger.warn("twilio.sms.signature_invalid", {
      url,
      hasSignature: !!signatureHeader,
    });
    return jsonForbidden("Invalid Twilio signature");
  }

  const messageSid = params.MessageSid ?? "";
  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);
  const body = params.Body ?? "";
  const msgStatus = params.SmsStatus ?? params.MessageStatus ?? "received";
  const keyword = detectSmsKeyword(body);

  // Step 3: idempotent webhook_events record.
  let isDuplicate = false;
  if (isDatabaseConfigured() && messageSid) {
    try {
      const result = await recordWebhookEvent({
        provider: "twilio",
        eventType: `sms.inbound${keyword ? `.${keyword}` : ""}`,
        externalId: `sms:${messageSid}`,
        payload: params,
      });
      isDuplicate = result.recorded && result.duplicate;
    } catch (err) {
      logger.error("twilio.sms.persist_failed", {
        messageSid,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  } else {
    logger.info("twilio.sms.received", {
      messageSid,
      keyword,
      dbConfigured: isDatabaseConfigured(),
    });
  }

  // Steps 4–9: clinic lookup, message recording, opt-out actions.
  // Skipped on duplicate (already processed) or when DB / params are missing.
  if (!isDuplicate && isDatabaseConfigured() && messageSid && from && to) {
    try {
      // Removal-aware lookup: resolves the clinic for active AND scheduled numbers.
      const routing = await lookupClinicByPhoneIncludingScheduled(to);

      if (!routing) {
        logger.info("twilio.sms.no_clinic_mapping", { to });
      } else if (routing.removalStatus === "scheduled") {
        // Scheduled (removal-pending) number: do NOT create a conversation or
        // record ordinary replies as routed clinic messages. Still honor STOP/
        // START compliance for the resolved clinic so opt-out state stays correct.
        if (keyword === "stop") {
          await upsertOptOut(routing.clinic.id, from);
          logger.info("twilio.sms.scheduled_opted_out", { clinicId: routing.clinic.id });
        } else if (keyword === "start") {
          await clearOptOut(routing.clinic.id, from);
          logger.info("twilio.sms.scheduled_opted_in", { clinicId: routing.clinic.id });
        } else {
          logger.info("twilio.sms.scheduled_number_skip", { to });
        }
      } else {
        const clinic = routing.clinic;
        // Get or create conversation thread for this (clinic, patient) pair.
        const { id: conversationId } = await getOrCreateConversation(
          clinic.id,
          from,
        );

        // Record the inbound message.
        let inboundIsDuplicate = false;
        try {
          const recorded = await recordInboundMessage({
            clinicId: clinic.id,
            conversationId,
            twilioMessageSid: messageSid,
            fromNumber: from,
            toNumber: to,
            body,
            status: msgStatus,
            detectedKeyword: keyword,
            rawPayload: params,
          });
          inboundIsDuplicate = recorded.duplicate;
          if (!recorded.duplicate) {
            await touchConversation(conversationId);
          }
        } catch (err) {
          logger.error("twilio.sms.record_inbound_failed", {
            messageSid,
            message: err instanceof Error ? err.message : "unknown",
          });
          // Non-fatal: continue to opt-out action even if message record fails.
        }

        // Opt-out / opt-in actions.
        if (keyword === "stop") {
          await upsertOptOut(clinic.id, from);
          logger.info("twilio.sms.opted_out", { clinicId: clinic.id });
        } else if (keyword === "start") {
          await clearOptOut(clinic.id, from);
          logger.info("twilio.sms.opted_in", { clinicId: clinic.id });
        }

        // Ordinary (non-keyword), first-seen reply: classify deterministically,
        // conservatively collect a patient name, and run the deterministic
        // auto-reply flow. Thanks/acks/negative/unclear replies are saved above
        // but never consume an auto-reply slot.
        if (!keyword && !inboundIsDuplicate) {
          const reply = classifyInboundReply(body);
          try {
            if (reply.patientName) {
              await setPatientDisplayNameIfEmpty(conversationId, reply.patientName);
            }
          } catch (err) {
            logger.error("twilio.sms.name_extract_failed", {
              messageSid,
              message: err instanceof Error ? err.message : "unknown",
            });
          }

          try {
            await maybeSendConversationAutoReply({
              clinic,
              patientPhone: from,
              twilioPhone: to,
              conversationId,
              keyword,
              isDuplicateInbound: inboundIsDuplicate,
              replyClassification: reply.kind,
            });
          } catch (err) {
            logger.error("twilio.sms.auto_reply_failed", {
              messageSid,
              message: err instanceof Error ? err.message : "unknown",
            });
            // Never surface auto-reply errors to Twilio — always return 200.
          }
        }
      }
    } catch (err) {
      logger.error("twilio.sms.process_failed", {
        messageSid,
        message: err instanceof Error ? err.message : "unknown",
      });
      // Never surface processing errors to Twilio — always return 200.
    }
  }

  // Step 11: return empty TwiML for all cases.
  // Twilio's Messaging Service sends STOP/START/HELP compliance replies itself.
  // Returning a <Message> here caused callers to receive duplicate replies.
  return twimlResponse();
}
