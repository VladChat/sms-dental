import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv, getSmsRecoveryConfig, getAppDomainsSafe } from "../env";
import { recordOutboundMessage, hasPriorRecoveryOutbound } from "../db/messages";
import {
  claimAutoReplySequence,
  getConversationAutoReplyState,
  touchConversation,
} from "../db/conversations";
import { isPhoneOptedOut } from "../db/opt-outs";
import { getClinicConversationConfig } from "../db/sms-conversation-settings";
import { evaluateSmsReadinessForLiveSend } from "../db/sms-readiness";
import { evaluateRecoverySendGate } from "../sms-recovery/live-send-evaluation";
import { evaluateAutoReplyDecision } from "../sms-recovery/auto-reply-evaluation";
import {
  replyClassificationBlocksAutoReply,
  type ReplyClassificationKind,
} from "../sms-recovery/reply-classification";
import {
  enabledFollowUpSequences,
  followUpBodyForSlot,
  renderConversationTemplate,
} from "../sms-recovery/conversation-templates";
import { normalizePhone } from "../phone/normalize";
import { logger } from "../logging/logger";

export type AutoReplyInput = {
  clinic: {
    id: string;
    name: string;
    sms_recovery_enabled: boolean;
    sms_status?: string;
  };
  // Patient (inbound From) — the recipient of the auto-reply.
  patientPhone: string;
  // Our number the patient texted (inbound To) — the pinned sender.
  twilioPhone: string;
  conversationId: string;
  keyword: "stop" | "start" | "help" | null;
  isDuplicateInbound: boolean;
  replyClassification: ReplyClassificationKind | null;
};

export type AutoReplyResult =
  | { sent: true; messageSid: string; sequence: 1 | 2 | 3 }
  | { sent: false; reason: string };

// Deterministically send (at most) one configured conversation auto-reply after
// an ordinary patient reply. This is the ONLY auto-reply send path; it enforces
// every guard itself (mode, exact-number readiness, clinic gate, opt-out,
// max_auto_replies, enabled template slot, prior recovery, keyword/duplicate)
// so callers cannot skip them. No AI; deterministic templates only.
export async function maybeSendConversationAutoReply(
  input: AutoReplyInput,
): Promise<AutoReplyResult> {
  // Cheap pre-checks first — avoid readiness/Twilio work on the common path
  // where auto-replies are disabled.
  if (input.keyword) return skipAutoReply(input, `keyword_${input.keyword}`);
  if (input.isDuplicateInbound) return skipAutoReply(input, "duplicate_inbound");
  const classificationBlock = replyClassificationBlocksAutoReply(input.replyClassification);
  if (classificationBlock) return skipAutoReply(input, classificationBlock);

  const smsConfig = getSmsRecoveryConfig();
  const modeAllowsSend = smsConfig.mode === "owner_test" || smsConfig.mode === "live";
  if (!modeAllowsSend) return skipAutoReply(input, "mode_disabled");

  const config = await getClinicConversationConfig(input.clinic.id);
  if (config.maxAutoReplies <= 0) return skipAutoReply(input, "auto_replies_disabled");
  const enabledSequences = enabledFollowUpSequences(config);
  if (enabledSequences.length === 0) return skipAutoReply(input, "template_disabled");

  const state = await getConversationAutoReplyState(input.conversationId);
  if (!state) return skipAutoReply(input, "conversation_missing");

  // Gather the remaining (DB-backed) inputs for the shared decision.
  const [hasPrior, optedOut, readiness] = await Promise.all([
    hasPriorRecoveryOutbound(input.conversationId),
    isPhoneOptedOut(input.clinic.id, input.patientPhone),
    evaluateSmsReadinessForLiveSend(input.clinic.id, input.twilioPhone),
  ]);
  const gate = evaluateRecoverySendGate({
    mode: smsConfig.mode,
    allowedTestNumbers: smsConfig.allowedNumbers,
    patientPhone: input.patientPhone,
    clinicSmsRecoveryEnabled: input.clinic.sms_recovery_enabled,
    clinicSmsStatus: input.clinic.sms_status,
    numberReadiness: readiness,
  });

  const decision = evaluateAutoReplyDecision({
    keyword: input.keyword,
    isDuplicateInbound: input.isDuplicateInbound,
    replyClassification: input.replyClassification,
    modeAllowsSend,
    gateOk: gate.ok,
    optedOut,
    hasPriorRecoveryOutbound: hasPrior,
    maxAutoReplies: config.maxAutoReplies,
    currentAutoReplyCount: state.smsAutoReplyCount,
    patientNameKnown: (state.patientDisplayName ?? "").trim().length > 0,
    enabledSequences,
  });
  if (!decision.send) {
    return skipAutoReply(input, decision.reason);
  }

  const rawBody = followUpBodyForSlot(config, decision.sequence);
  if (!rawBody) return skipAutoReply(input, "template_disabled");
  const body = renderConversationTemplate(rawBody, {
    clinicName: input.clinic.name,
    patientName: state.patientDisplayName,
  });
  if (body.trim().length === 0) return skipAutoReply(input, "empty_body");

  // Atomically claim the slot. A concurrent delivery/retry that already advanced
  // the count loses the compare and we abort — no duplicate auto-reply.
  const claimed = await claimAutoReplySequence(
    input.conversationId,
    state.smsAutoReplyCount,
    decision.sequence,
  );
  if (claimed === null) {
    return skipAutoReply(input, "slot_already_claimed");
  }

  const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
  const client = getTwilioClient();
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl;
  const statusCallback = appBaseUrl
    ? `${appBaseUrl}/api/webhooks/twilio/messaging/status`
    : undefined;

  let messageSid: string;
  let messageStatus: string;
  let messageFrom: string;
  try {
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
    logger.error("twilio.sms.auto_reply_send_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    // Slot already claimed; we intentionally do not roll back so a Twilio retry
    // of the inbound never produces a second send attempt for the same slot.
    return { sent: false, reason: "twilio_send_error" };
  }

  const senderMismatch = normalizePhone(messageFrom) !== normalizePhone(input.twilioPhone);
  if (senderMismatch) {
    logger.error("twilio.sms.auto_reply_sender_mismatch", {
      clinicId: input.clinic.id,
      messageSid,
      expectedFrom: input.twilioPhone,
      actualFrom: messageFrom,
    });
  }

  try {
    await recordOutboundMessage({
      clinicId: input.clinic.id,
      conversationId: input.conversationId,
      twilioMessageSid: messageSid,
      fromNumber: messageFrom,
      toNumber: input.patientPhone,
      body,
      status: messageStatus,
      messageKind: "conversation_auto_reply",
      rawPayload: {
        sid: messageSid,
        status: messageStatus,
        to: input.patientPhone,
        from: messageFrom,
        expected_from: input.twilioPhone,
        sender_mismatch: senderMismatch,
        auto_reply_sequence: decision.sequence,
      },
    });
    await touchConversation(input.conversationId);
  } catch (err) {
    logger.error("twilio.sms.auto_reply_record_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  logger.info("twilio.sms.auto_reply_sent", {
    clinicId: input.clinic.id,
    messageSid,
    sequence: decision.sequence,
  });
  return { sent: true, messageSid, sequence: decision.sequence };
}

function skipAutoReply(input: AutoReplyInput, reason: string): AutoReplyResult {
  logger.info("twilio.sms.auto_reply_skipped", {
    clinicId: input.clinic.id,
    reason,
  });
  return { sent: false, reason };
}
