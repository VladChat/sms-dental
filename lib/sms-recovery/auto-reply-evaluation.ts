// Pure decision for whether to send a deterministic conversation auto-reply,
// and which follow-up slot. All inputs are gathered by the inbound webhook
// (config, conversation state, readiness, opt-out); this function applies the
// ordered gates so the logic is unit-testable without a DB or Twilio.

export type AutoReplyDecisionInput = {
  // Compliance keyword detected on the inbound message, if any.
  keyword: "stop" | "start" | "help" | null;
  // The inbound webhook was a duplicate (Twilio retry) — never act twice.
  isDuplicateInbound: boolean;
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
  // Follow-up slots (1..3) that are enabled AND have a usable body, already
  // capped by maxAutoReplies.
  enabledSequences: number[];
};

export type AutoReplyDecision =
  | { send: false; reason: string }
  | { send: true; sequence: 1 | 2 | 3 };

export function evaluateAutoReplyDecision(input: AutoReplyDecisionInput): AutoReplyDecision {
  // Compliance + idempotency first — these never produce an auto-reply.
  if (input.keyword) return { send: false, reason: `keyword_${input.keyword}` };
  if (input.isDuplicateInbound) return { send: false, reason: "duplicate_inbound" };

  // Hard send gates (same discipline as the missed-call send path).
  if (!input.modeAllowsSend) return { send: false, reason: "mode_disabled" };
  if (input.optedOut) return { send: false, reason: "opted_out" };
  if (!input.hasPriorRecoveryOutbound) return { send: false, reason: "no_prior_recovery" };

  // Admin configuration gates.
  if (input.maxAutoReplies <= 0) return { send: false, reason: "auto_replies_disabled" };
  const next = input.currentAutoReplyCount + 1;
  if (next > input.maxAutoReplies || next > 3) {
    return { send: false, reason: "max_auto_replies_reached" };
  }
  if (!input.enabledSequences.includes(next)) {
    return { send: false, reason: "template_disabled" };
  }

  // Readiness/clinic gate last so its (DB-backed) failure is distinguishable.
  if (!input.gateOk) return { send: false, reason: "send_gate_blocked" };

  return { send: true, sequence: next as 1 | 2 | 3 };
}
