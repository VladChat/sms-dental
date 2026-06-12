import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv, getSmsRecoveryConfig, getAppDomainsSafe } from "../env";
import { getDb } from "../db/client";
import {
  hasSentRecoverySmsSince,
  recordOutboundMessage,
} from "../db/messages";
import {
  resetConversationAutoReplyCycle,
  touchConversation,
} from "../db/conversations";
import { evaluateSmsReadinessForLiveSend } from "../db/sms-readiness";
import {
  evaluateDuplicateSuppression,
  evaluateRecoverySendGate,
} from "../sms-recovery/live-send-evaluation";
import {
  buildMissedCallRecoverySmsBody,
  getDuplicateSuppressionWindowMs,
} from "../sms-recovery/templates";
import { buildRecoverySmsBodyFromConversationConfig } from "../sms-recovery/send-body";
import { getClinicConversationConfig } from "../db/sms-conversation-settings";
import { normalizePhone } from "../phone/normalize";
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

  // Guard 2: exact-number readiness — enforced in BOTH owner_test and live.
  // The selected business number must be active/routable with active texting
  // status, Messaging Service coverage, and (local) production-safe A2P.
  // Missing/stale rows fail closed before Twilio. The owner-test allowlist is
  // an additional gate below, never a substitute for number readiness.
  const readiness = await evaluateSmsReadinessForLiveSend(
    input.clinic.id,
    input.twilioPhone,
  );

  // Guard 3: mode-specific gates in one shared, unit-tested decision —
  // live: clinic.sms_recovery_enabled + (local) clinic.sms_status active;
  // owner_test: caller must be in the SMS_TEST_ALLOWED_TO allowlist.
  const gate = evaluateRecoverySendGate({
    mode: config.mode,
    allowedTestNumbers: config.allowedNumbers,
    patientPhone: input.patientPhone,
    clinicSmsRecoveryEnabled: input.clinic.sms_recovery_enabled,
    clinicSmsStatus: input.clinic.sms_status,
    numberReadiness: readiness,
  });
  if (!gate.ok) {
    logger.info("twilio.sms.send_blocked", {
      clinicId: input.clinic.id,
      mode: config.mode,
      reason: gate.reason,
    });
    return { sent: false, reason: gate.reason };
  }

  // Guard 4: opt-out check.
  const isOptedOut = await isPhoneOptedOut(input.clinic.id, input.patientPhone);
  if (isOptedOut) {
    return { sent: false, reason: "opted_out" };
  }

  // Guard 5: duplicate suppression — no repeat SMS within the configured window.
  const suppressionStart = new Date(Date.now() - getDuplicateSuppressionWindowMs());
  const alreadySent = await hasSentRecoverySmsSince(
    input.clinic.id,
    input.patientPhone,
    suppressionStart,
  );
  const duplicateDecision = evaluateDuplicateSuppression({
    patientPhone: input.patientPhone,
    alreadySent,
    bypassNumbers: config.duplicateSuppressionBypassNumbers,
  });
  if (!duplicateDecision.ok) {
    logger.info("twilio.sms.skipped_duplicate", { clinicId: input.clinic.id });
    return { sent: false, reason: "duplicate_suppressed" };
  }
  if (duplicateDecision.bypassed) {
    logger.info("twilio.sms.duplicate_suppression_bypassed_for_test_number", {
      clinicId: input.clinic.id,
      patientPhoneLast4: input.patientPhone.slice(-4),
    });
  }

  // All guards passed. Build the message body. With no admin-configured initial
  // template this is byte-for-byte the fixed, compliance-reviewed default. Saved
  // full templates are rendered directly, and legacy middle-only rows are
  // wrapped safely. Settings/build failure falls back to the approved default.
  let body: string;
  try {
    const config = await getClinicConversationConfig(input.clinic.id);
    body = buildRecoverySmsBodyFromConversationConfig(input.clinic.name, config);
  } catch (err) {
    logger.warn("twilio.sms.initial_template_fallback", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    body = buildMissedCallRecoverySmsBody(input.clinic.name);
  }

  const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
  const client = getTwilioClient();

  // Per-message delivery status callback (in addition to the Messaging Service
  // level callback) so message rows can be updated even if the service-level
  // setting is ever lost.
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl;
  const statusCallback = appBaseUrl
    ? `${appBaseUrl}/api/webhooks/twilio/messaging/status`
    : undefined;

  let messageSid: string;
  let messageStatus: string;
  let messageFrom: string;

  try {
    // `from` + `messagingServiceSid` together pin the sender to the EXACT number
    // the patient called, while keeping Messaging Service features (opt-out
    // handling, callbacks). Twilio rejects the send (error 21712) if this number
    // is not in the service's sender pool — fail closed, never another clinic's
    // number.
    const msg = await client.messages.create({
      body,
      to: input.patientPhone,
      from: input.twilioPhone,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      ...(statusCallback ? { statusCallback } : {}),
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

  // Record the ACTUAL sender Twilio used. A mismatch with the expected number
  // is a serious diagnostic problem (wrong clinic identity on the SMS) — log it
  // loudly for the operator. The message has already left, so this cannot be
  // blocked here; the guard above makes it practically unreachable.
  const senderMismatch =
    normalizePhone(messageFrom) !== normalizePhone(input.twilioPhone);
  if (senderMismatch) {
    logger.error("twilio.sms.sender_mismatch", {
      clinicId: input.clinic.id,
      messageSid,
      expectedFrom: input.twilioPhone,
      actualFrom: messageFrom,
    });
  }

  // Record send in messages table (non-fatal on failure).
  let recoveryMessageRecorded = false;
  try {
    await recordOutboundMessage({
      clinicId: input.clinic.id,
      conversationId: input.conversationId,
      twilioMessageSid: messageSid,
      fromNumber: messageFrom,
      toNumber: input.patientPhone,
      body,
      status: messageStatus,
      messageKind: "missed_call_recovery",
      rawPayload: {
        sid: messageSid,
        status: messageStatus,
        to: input.patientPhone,
        from: messageFrom,
        expected_from: input.twilioPhone,
        sender_mismatch: senderMismatch,
      },
    });
    recoveryMessageRecorded = true;
  } catch (err) {
    logger.error("twilio.sms.record_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    // SMS was sent. Recording failure is non-fatal — log and continue.
  }

  // Start a fresh auto-reply cycle only after Twilio accepted the recovery SMS
  // and the missed_call_recovery outbound row was recorded.
  if (recoveryMessageRecorded && input.conversationId) {
    try {
      await resetConversationAutoReplyCycle(input.conversationId);
    } catch (err) {
      logger.error("twilio.sms.auto_reply_cycle_reset_failed", {
        clinicId: input.clinic.id,
        message: err instanceof Error ? err.message : "unknown",
      });
    }

    try {
      await touchConversation(input.conversationId);
    } catch (err) {
      logger.error("twilio.sms.conversation_touch_failed", {
        clinicId: input.clinic.id,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
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
