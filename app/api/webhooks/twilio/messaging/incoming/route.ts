import { NextRequest } from "next/server";
import {
  jsonForbidden,
  twimlResponse,
} from "@/lib/http/responses";
import {
  readTwilioFormPayload,
  reconstructTwilioWebhookUrl,
} from "@/lib/twilio/request";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { detectSmsKeyword } from "@/lib/twilio/keywords";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio incoming SMS webhook. Foundation behavior:
//   - validate signature
//   - parse form payload
//   - detect STOP/START/HELP (no DB write of opt-out state yet — that lands
//     with the messaging milestone once the clinic/phone-number mapping is in
//     place)
//   - log/record a webhook_event idempotently (when DB is configured)
//   - return an empty TwiML response (no outbound SMS yet)
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
  const from = params.From ?? "";
  const to = params.To ?? "";
  const body = params.Body ?? "";
  const keyword = detectSmsKeyword(body);

  if (isDatabaseConfigured() && messageSid) {
    try {
      await recordWebhookEvent({
        provider: "twilio",
        eventType: `sms.inbound${keyword ? `.${keyword}` : ""}`,
        externalId: `sms:${messageSid}`,
        payload: params,
      });
    } catch (err) {
      logger.error("twilio.sms.persist_failed", {
        messageSid,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  } else {
    logger.info("twilio.sms.received", {
      messageSid,
      from,
      to,
      keyword,
      dbConfigured: isDatabaseConfigured(),
    });
  }

  return twimlResponse();
}
