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
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_TWIML = `<Response><Say voice="alice">Thanks for calling. We missed your call and will be in touch shortly. Goodbye.</Say><Hangup/></Response>`;

// Twilio incoming voice webhook.
//   - validate signature
//   - parse form payload
//   - log/record a webhook_event idempotently (when DB is configured)
//   - return polite TwiML: Say + Hangup (no outbound SMS, no call forwarding)
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
  const from = params.From ?? "";
  const to = params.To ?? "";
  const direction = params.Direction ?? "";

  if (isDatabaseConfigured() && callSid) {
    try {
      await recordWebhookEvent({
        provider: "twilio",
        eventType: `voice.${callStatus || "unknown"}`,
        externalId: `voice:${callSid}`,
        payload: params,
      });
    } catch (err) {
      logger.error("twilio.voice.persist_failed", {
        callSid,
        message: err instanceof Error ? err.message : "unknown",
      });
      // Do not surface DB errors to Twilio — that would cause retries and
      // potentially flood the office line. Return a safe TwiML response.
    }
  } else {
    logger.info("twilio.voice.received", {
      callSid,
      callStatus,
      from,
      to,
      direction,
      dbConfigured: isDatabaseConfigured(),
    });
  }

  return twimlResponse(VOICE_TWIML);
}
