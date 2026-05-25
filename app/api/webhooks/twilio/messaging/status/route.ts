import { NextRequest } from "next/server";
import { jsonForbidden, jsonOk } from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio message status callback. Foundation behavior:
//   - validate signature
//   - parse form payload
//   - log/record a webhook_event idempotently (one per (MessageSid, status))
//   - return a 200 JSON ack (Twilio does not require TwiML on status callbacks)
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
