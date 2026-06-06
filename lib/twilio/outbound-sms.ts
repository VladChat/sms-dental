import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv, getSmsRecoveryConfig } from "../env";
import { getDb } from "../db/client";
import {
  hasSentRecoverySmsSince,
  recordOutboundMessage,
} from "../db/messages";
import { touchConversation } from "../db/conversations";
import { evaluateSmsReadinessForLiveSend } from "../db/sms-readiness";
import { logger } from "../logging/logger";

export type SendRecoverySmsInput = {
  clinic: {
    id: string;
    name: string;
    sms_recovery_enabled: boolean;
    sms_status?: string;
  };
  patientPhone: string;
  twilioPhone: string;
  conversationId: string | null;
};

export type SendRecoverySmsResult =
  | { sent: true; messageSid: string }
  | { sent: false; reason: string };

// Attempt to send a missed-call recovery SMS.
//
// All guards run before the Twilio API is called. Any single guard failure
// returns { sent: false, reason } without throwing. Callers must not send SMS
// through any other path — route this through here so guards cannot be skipped.
export async function sendRecoverySms(
  input: SendRecoverySmsInput,
): Promise<SendRecoverySmsResult> {
  // Guard 1: SMS_RECOVERY_MODE must be owner_test or live.
  // Default is "disabled" — no SMS is ever sent unless explicitly configured.
  const config = getSmsRecoveryConfig();
  if (config.mode !== "owner_test" && config.mode !== "live") {
    return { sent: false, reason: `sms_mode_${config.mode}` };
  }

  // Guard 2 (live mode only): clinic must have sms_recovery_enabled = true.
  // New clinics default to false — safe until explicitly onboarded.
  // In owner_test mode the allowlist is the gate; this flag is not checked.
  if (config.mode === "live" && !input.clinic.sms_recovery_enabled) {
    logger.info("twilio.sms.skipped_clinic_disabled", {
      clinicId: input.clinic.id,
    });
    return { sent: false, reason: "clinic_sms_disabled" };
  }

  // Guard 2b (live mode only): clinic status + provider readiness must be
  // production-safe. Missing/stale readiness rows fail closed before Twilio.
  if (config.mode === "live") {
    if (input.clinic.sms_status !== "active") {
      logger.info("twilio.sms.skipped_sms_status_not_active", {
        clinicId: input.clinic.id,
        smsStatus: input.clinic.sms_status ?? "unknown",
      });
      return { sent: false, reason: "sms_status_not_active" };
    }

    const readiness = await evaluateSmsReadinessForLiveSend(
      input.clinic.id,
      input.twilioPhone,
    );
    if (!readiness.ok) {
      logger.info("twilio.sms.skipped_readiness_blocked", {
        clinicId: input.clinic.id,
        reason: readiness.reason,
      });
      return { sent: false, reason: readiness.reason };
    }
  }

  // Guard 3 (owner_test mode only): patient phone must be in the explicit allowlist.
  if (config.mode === "owner_test" && !config.allowedNumbers.includes(input.patientPhone)) {
    logger.info("twilio.sms.skipped_not_allowlisted", {
      clinicId: input.clinic.id,
    });
    return { sent: false, reason: "caller_not_allowlisted" };
  }

  // Guard 4: opt-out check.
  const isOptedOut = await isPhoneOptedOut(input.clinic.id, input.patientPhone);
  if (isOptedOut) {
    return { sent: false, reason: "opted_out" };
  }

  // Guard 5: duplicate suppression — no repeat SMS within 24 hours.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const alreadySent = await hasSentRecoverySmsSince(
    input.clinic.id,
    input.patientPhone,
    oneDayAgo,
  );
  if (alreadySent) {
    logger.info("twilio.sms.skipped_duplicate", { clinicId: input.clinic.id });
    return { sent: false, reason: "duplicate_suppressed" };
  }

  // All guards passed. Build message body.
  const body = `Hi, this is ${input.clinic.name}. We missed your call. Would you like us to help schedule an appointment?`;

  const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
  const client = getTwilioClient();

  let messageSid: string;
  let messageStatus: string;
  let messageFrom: string;

  try {
    const msg = await client.messages.create({
      body,
      to: input.patientPhone,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    });
    messageSid = msg.sid;
    messageStatus = msg.status as string;
    messageFrom = msg.from ?? input.twilioPhone;
  } catch (err) {
    logger.error("twilio.sms.send_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return { sent: false, reason: "twilio_send_error" };
  }

  // Record send in messages table (non-fatal on failure).
  try {
    await recordOutboundMessage({
      clinicId: input.clinic.id,
      conversationId: input.conversationId,
      twilioMessageSid: messageSid,
      fromNumber: messageFrom,
      toNumber: input.patientPhone,
      body,
      status: messageStatus,
      rawPayload: { sid: messageSid, status: messageStatus, to: input.patientPhone },
    });
    if (input.conversationId) {
      await touchConversation(input.conversationId);
    }
  } catch (err) {
    logger.error("twilio.sms.record_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    // SMS was sent. Recording failure is non-fatal — log and continue.
  }

  logger.info("twilio.sms.sent", {
    clinicId: input.clinic.id,
    messageSid,
  });

  return { sent: true, messageSid };
}

async function isPhoneOptedOut(
  clinicId: string,
  phoneNumber: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ opted_back_in_at: string | null }[]>`
    select opted_back_in_at
    from public.opt_outs
    where clinic_id   = ${clinicId}
      and phone_number = ${phoneNumber}
    limit 1
  `;
  if (!rows[0]) return false;
  return rows[0].opted_back_in_at === null;
}
