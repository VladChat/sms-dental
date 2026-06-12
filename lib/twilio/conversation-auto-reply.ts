import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv, getSmsRecoveryConfig, getAppDomainsSafe } from "../env";
import { recordOutboundMessage, hasPriorRecoveryOutbound } from "../db/messages";
import {
  claimAutoReplySequence,
  claimSafetyNotice,
  claimThanksCourtesyReply,
  getConversationAutoReplyState,
  recordUnansweredInboundAfterAutomation,
  touchConversation,
} from "../db/conversations";
import { isPhoneOptedOut } from "../db/opt-outs";
import { getClinicConversationConfig } from "../db/sms-conversation-settings";
import { evaluateSmsReadinessForLiveSend } from "../db/sms-readiness";
import { evaluateRecoverySendGate } from "../sms-recovery/live-send-evaluation";
import {
  evaluateAutoReplyDecision,
  evaluateThanksCourtesyDecision,
  prefixSafetyNotice,
  shouldAttemptSafetyNoticePrefix,
} from "../sms-recovery/auto-reply-evaluation";
import {
  replyClassificationBlocksAutoReply,
  type ReplyClassificationKind,
} from "../sms-recovery/reply-classification";
import {
  enabledFollowUpSequences,
  followUpBodyForSlot,
  renderConversationTemplate,
  type FollowUpSlot,
} from "../sms-recovery/conversation-templates";
import { specialReplyTextForKey } from "../sms-recovery/special-reply-templates";
import {
  isAutomationMuted,
  reasonCountsAsUnanswered,
  resolveAutomationVolumeSettings,
  type AutomationVolumeSettings,
} from "../sms-recovery/automation-volume-limits";
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
  | { sent: true; messageSid: string; sequence: FollowUpSlot; replyType: "follow_up" }
  | { sent: true; messageSid: string; replyType: "thanks_courtesy" }
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
  if (classificationBlock && input.replyClassification !== "thanks") {
    return skipAutoReply(input, classificationBlock);
  }

  const smsConfig = getSmsRecoveryConfig();
  const modeAllowsSend = smsConfig.mode === "owner_test" || smsConfig.mode === "live";
  if (!modeAllowsSend) return skipAutoReply(input, "mode_disabled");

  const config = await getClinicConversationConfig(input.clinic.id);
  if (config.maxAutoReplies <= 0) return skipAutoReply(input, "auto_replies_disabled");

  const state = await getConversationAutoReplyState(input.conversationId);
  if (!state) return skipAutoReply(input, "conversation_missing");

  // Anti-spam mute: while automation is paused for this conversation, NOTHING
  // automated sends (no follow-up, no thanks courtesy, no safety prefix).
  // Inbound messages were already recorded by the webhook, and STOP/START/HELP
  // never reach this point. Ordinary (non-blocked) replies keep counting
  // toward the high-volume flag; an active mute is never extended early.
  const volumeSettings = resolveAutomationVolumeSettings(config.antiSpam);
  if (isAutomationMuted(state, new Date())) {
    if (!replyClassificationBlocksAutoReply(input.replyClassification)) {
      await countUnansweredInbound(input, volumeSettings);
    }
    return skipAutoReply(input, "automation_muted");
  }

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

  if (input.replyClassification === "thanks") {
    const thanksDecision = evaluateThanksCourtesyDecision({
      keyword: input.keyword,
      isDuplicateInbound: input.isDuplicateInbound,
      replyClassification: input.replyClassification,
      modeAllowsSend,
      gateOk: gate.ok,
      optedOut,
      hasPriorRecoveryOutbound: hasPrior,
      maxAutoReplies: config.maxAutoReplies,
      thanksCourtesyAlreadySent: state.smsThanksCourtesySentAt !== null,
      customBody: config.specialReplies?.thanks_courtesy?.body ?? null,
    });
    if (!thanksDecision.send) return skipAutoReply(input, thanksDecision.reason);

    const claimed = await claimThanksCourtesyReply(input.conversationId);
    if (!claimed) return skipAutoReply(input, "thanks_courtesy_already_sent");

    const sent = await sendConversationAutoReplySms(input, thanksDecision.body, {
      auto_reply_type: "thanks_courtesy",
    });
    if (!sent.sent) return sent;
    return { sent: true, messageSid: sent.messageSid, replyType: "thanks_courtesy" };
  }

  const enabledSequences = enabledFollowUpSequences(config);
  if (enabledSequences.length === 0) {
    await countUnansweredInbound(input, volumeSettings);
    return skipAutoReply(input, "template_disabled");
  }

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
    // Automation ended for this cycle (max reached / no eligible slot): the
    // inbound stays unanswered and counts toward the mute/high-volume
    // thresholds. Gate/keyword/duplicate/classification skips never count.
    if (reasonCountsAsUnanswered(decision.reason)) {
      await countUnansweredInbound(input, volumeSettings);
    }
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

  // Safety-concern replies carry a conditional 911 line ONCE per recovery
  // cycle, prepended to the normal follow-up (which keeps its claimed slot).
  // The claim is atomic and never rolled back after a failed send; if another
  // delivery already claimed it, the follow-up sends without the prefix.
  let safetyNoticeApplied = false;
  if (
    shouldAttemptSafetyNoticePrefix({
      replyClassification: input.replyClassification,
      safetyNoticeAlreadySent: state.smsSafetyNoticeSentAt !== null,
    })
  ) {
    safetyNoticeApplied = await claimSafetyNotice(input.conversationId);
  }

  const sent = await sendConversationAutoReplySms(
    input,
    safetyNoticeApplied
      ? prefixSafetyNotice(body, specialReplyTextForKey(config.specialReplies, "safety_notice"))
      : body,
    {
      auto_reply_sequence: decision.sequence,
      ...(safetyNoticeApplied ? { safety_notice: true } : {}),
    },
  );
  if (!sent.sent) return sent;
  return {
    sent: true,
    messageSid: sent.messageSid,
    sequence: decision.sequence,
    replyType: "follow_up",
  };
}

async function sendConversationAutoReplySms(
  input: AutoReplyInput,
  body: string,
  metadata: Record<string, unknown>,
): Promise<{ sent: true; messageSid: string } | { sent: false; reason: string }> {
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
    // The slot/courtesy marker is already claimed; we intentionally do not roll
    // back so a Twilio retry never produces a second send attempt.
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
        ...metadata,
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
    ...metadata,
  });
  return { sent: true, messageSid };
}

function skipAutoReply(input: AutoReplyInput, reason: string): AutoReplyResult {
  logger.info("twilio.sms.auto_reply_skipped", {
    clinicId: input.clinic.id,
    reason,
  });
  return { sent: false, reason };
}

// Count one unanswered-after-automation inbound (atomic in the DB) and log
// when the mute or high-volume threshold is crossed. Never throws — counting
// failures must not affect webhook handling or message recording.
async function countUnansweredInbound(
  input: AutoReplyInput,
  settings: AutomationVolumeSettings,
): Promise<void> {
  try {
    const result = await recordUnansweredInboundAfterAutomation(input.conversationId, settings);
    if (!result) return;
    logger.info("twilio.sms.unanswered_after_automation", {
      clinicId: input.clinic.id,
      count: result.unansweredAfterAutomationCount,
      muted: result.automationMutedUntil !== null,
      highVolume: result.highVolumeFlaggedAt !== null,
    });
  } catch (err) {
    logger.error("twilio.sms.unanswered_count_failed", {
      clinicId: input.clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}
