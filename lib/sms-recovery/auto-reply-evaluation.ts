// Pure decision for whether to send a deterministic conversation auto-reply,
// and which follow-up slot. All inputs are gathered by the inbound webhook
// (config, conversation state, readiness, opt-out); this function applies the
// ordered gates so the logic is unit-testable without a DB or Twilio.

import {
  replyClassificationBlocksAutoReply,
  type ReplyClassificationKind,
} from "./reply-classification";
import { MAX_AUTO_REPLIES, type FollowUpSlot } from "./conversation-templates";

export const THANKS_COURTESY_REPLY_BODY = "You're welcome. Our team will follow up.";

export type AutoReplyDecisionInput = {
  // Compliance keyword detected on the inbound message, if any.
  keyword: "stop" | "start" | "help" | null;
  // The inbound webhook was a duplicate (Twilio retry) — never act twice.
  isDuplicateInbound: boolean;
  // Deterministic inbound reply class. Simple thanks/acks/negative/unclear
  // replies are saved but never produce an automated follow-up.
  replyClassification: ReplyClassificationKind | null;
  // SMS_RECOVERY_MODE is live or owner_test (else no sends at all).
  modeAllowsSend: boolean;
  // Shared recovery send gate result (clinic enabled + readiness, or owner-test
  // allowlist). Mirrors the missed-call send path.
  gateOk: boolean;
  // Patient has an active opt-out for this clinic.
  optedOut: boolean;
  // There is a prior missed-call recovery outbound in this conversation. We only
  // auto-reply inside an existing recovery thread.
  hasPriorRecoveryOutbound: boolean;
  // Admin-configured cap (0 disables auto-replies).
  maxAutoReplies: number;
  // Auto-replies already sent in this conversation.
  currentAutoReplyCount: number;
  // A patient name is already stored, or was safely extracted from this reply.
  // In that case the default first "what name?" follow-up is skipped.
  patientNameKnown: boolean;
  // Follow-up slots (1..10) that are enabled AND have a usable body, already
  // capped by maxAutoReplies.
  enabledSequences: number[];
};

export type AutoReplyDecision =
  | { send: false; reason: string }
  | { send: true; sequence: FollowUpSlot };

export function evaluateAutoReplyDecision(input: AutoReplyDecisionInput): AutoReplyDecision {
  // Compliance + idempotency first — these never produce an auto-reply.
  if (input.keyword) return { send: false, reason: `keyword_${input.keyword}` };
  if (input.isDuplicateInbound) return { send: false, reason: "duplicate_inbound" };

  const classificationBlock = replyClassificationBlocksAutoReply(input.replyClassification);
  if (classificationBlock) return { send: false, reason: classificationBlock };

  // Hard send gates (same discipline as the missed-call send path).
  if (!input.modeAllowsSend) return { send: false, reason: "mode_disabled" };
  if (input.optedOut) return { send: false, reason: "opted_out" };
  if (!input.hasPriorRecoveryOutbound) return { send: false, reason: "no_prior_recovery" };

  // Admin configuration gates.
  if (input.maxAutoReplies <= 0) return { send: false, reason: "auto_replies_disabled" };
  const next =
    input.patientNameKnown && input.currentAutoReplyCount === 0
      ? 2
      : input.currentAutoReplyCount + 1;
  if (next > input.maxAutoReplies || next > MAX_AUTO_REPLIES) {
    return { send: false, reason: "max_auto_replies_reached" };
  }
  if (!input.enabledSequences.includes(next)) {
    return { send: false, reason: "template_disabled" };
  }

  // Readiness/clinic gate last so its (DB-backed) failure is distinguishable.
  if (!input.gateOk) return { send: false, reason: "send_gate_blocked" };

  return { send: true, sequence: next as FollowUpSlot };
}

export type ThanksCourtesyDecisionInput = {
  keyword: "stop" | "start" | "help" | null;
  isDuplicateInbound: boolean;
  replyClassification: ReplyClassificationKind | null;
  modeAllowsSend: boolean;
  gateOk: boolean;
  optedOut: boolean;
  hasPriorRecoveryOutbound: boolean;
  maxAutoReplies: number;
  thanksCourtesyAlreadySent: boolean;
};

export type ThanksCourtesyDecision =
  | { send: false; reason: string }
  | { send: true; body: typeof THANKS_COURTESY_REPLY_BODY };

export function evaluateThanksCourtesyDecision(
  input: ThanksCourtesyDecisionInput,
): ThanksCourtesyDecision {
  if (input.keyword) return { send: false, reason: `keyword_${input.keyword}` };
  if (input.isDuplicateInbound) return { send: false, reason: "duplicate_inbound" };
  if (input.replyClassification !== "thanks") {
    return { send: false, reason: "not_thanks" };
  }
  if (!input.modeAllowsSend) return { send: false, reason: "mode_disabled" };
  if (input.maxAutoReplies <= 0) return { send: false, reason: "auto_replies_disabled" };
  if (input.optedOut) return { send: false, reason: "opted_out" };
  if (!input.hasPriorRecoveryOutbound) return { send: false, reason: "no_prior_recovery" };
  if (input.thanksCourtesyAlreadySent) {
    return { send: false, reason: "thanks_courtesy_already_sent" };
  }
  if (!input.gateOk) return { send: false, reason: "send_gate_blocked" };

  return { send: true, body: THANKS_COURTESY_REPLY_BODY };
}
