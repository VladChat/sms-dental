import { NextRequest } from "next/server";
import { jsonForbidden, jsonOk } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { updateOutboundMessageStatus } from "@/lib/db/messages";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio message status callback.
//   - validate signature
//   - parse form payload
//   - record a webhook_event idempotently (one per (MessageSid, status))
//   - update the matching outbound messages row (status + provider error),
//     idempotently and without regressing a more advanced status
//   - return a 200 JSON ack (Twilio does not require TwiML on status callbacks);
//     normal provider retries never receive an error from this route
export async function POST(request: NextRequest) {
  const url = reconstructTwilioWebhookUrl(request);
  const params = await readTwilioFormPayload(request);
  const signatureHeader = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature({ signatureHeader, url, params })) {
    logger.warn("twilio.sms.status.signature_invalid", {
      url,
      hasSignature: !!signatureHeader,
    });
    return jsonForbidden("Invalid Twilio signature");
  }

  const messageSid = params.MessageSid ?? "";
  const messageStatus = params.MessageStatus ?? "";
  const errorCode = params.ErrorCode ?? "";

  if (isDatabaseConfigured() && messageSid && messageStatus) {
    try {
      await recordWebhookEvent({
        provider: "twilio",
        eventType: `sms.status.${messageStatus}`,
        externalId: `sms_status:${messageSid}:${messageStatus}`,
        payload: params,
      });
    } catch (err) {
      logger.error("twilio.sms.status.persist_failed", {
        messageSid,
        messageStatus,
        message: err instanceof Error ? err.message : "unknown",
      });
    }

    // Update the outbound message row. Runs even when the webhook event was a
    // duplicate — the helper is idempotent and never regresses a status. A
    // missing row (e.g. a Twilio compliance auto-reply we never recorded) is
    // logged and acknowledged, not an error to Twilio.
    try {
      const result = await updateOutboundMessageStatus({
        twilioMessageSid: messageSid,
        status: messageStatus,
        errorCode: errorCode || null,
        errorMessage: params.ErrorMessage || null,
      });
      if (!result.found) {
        logger.info("twilio.sms.status.message_row_missing", {
          messageSid,
          messageStatus,
        });
      }
    } catch (err) {
      logger.error("twilio.sms.status.message_update_failed", {
        messageSid,
        messageStatus,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  } else {
    logger.info("twilio.sms.status.received", {
      messageSid,
      messageStatus,
      errorCode,
      dbConfigured: isDatabaseConfigured(),
    });
  }

  return jsonOk({ ok: true });
}
