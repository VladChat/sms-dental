// Deterministic, front-desk-safe AI answered call summary derivation.
//
// Pure module: no DB, no Twilio, no AI/provider calls — unit-testable. It turns
// the small set of fields an AI voice session captured (name/reason/preferred
// time/summary headline + a safety flag) into safe Workspace display values.
//
// Fails closed: when there is no usable reason or summary it falls back to
// "Review conversation". The safety signal only ever produces a front-desk
// ATTENTION flag — never diagnosis, triage, or medical advice text.

import {
  WORKSPACE_SOURCE_CHANNEL_LABEL,
  type AiVoiceSessionStatus,
  type WorkspaceSourceChannel,
} from "../../config/ai-answering.config";

export const AI_VOICE_REVIEW_FALLBACK = "Review conversation";

// Decide which source channel a Workspace request reached the office through.
// SMS-only (or no captured AI voice session) stays "sms" so existing behavior is
// unchanged. AI voice with SMS messages is "mixed"; AI voice alone is "ai_voice".
export function deriveWorkspaceSourceChannel(input: {
  hasSms: boolean;
  hasAiVoice: boolean;
}): WorkspaceSourceChannel {
  if (input.hasAiVoice && input.hasSms) return "mixed";
  if (input.hasAiVoice) return "ai_voice";
  return "sms";
}

export function workspaceSourceChannelLabel(channel: WorkspaceSourceChannel): string {
  return WORKSPACE_SOURCE_CHANNEL_LABEL[channel];
}

export type AiVoiceSummaryInput = {
  status: AiVoiceSessionStatus;
  capturedReason?: string | null;
  capturedPreferredTime?: string | null;
  // An upstream-written one-line summary, if any. Nothing produces this with AI
  // today; it is stored deterministically from the captured reason for mocks.
  summaryHeadline?: string | null;
  safetySignal?: boolean | null;
};

export type AiVoiceCallSummary = {
  // One short, safe line for the front desk. Never medical advice.
  headline: string;
  reason: string | null;
  preferredTime: string | null;
  // True only flags the request for urgent front-desk attention. It carries no
  // diagnosis, no triage, and no medical instruction.
  safetyConcern: boolean;
  source: "ai_summary" | "reason" | "fallback";
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

// Build the safe AI call summary. Order of preference for the headline:
//   1. a provided summary headline (source "ai_summary")
//   2. the captured reason, optionally suffixed with the preferred time (source "reason")
//   3. "Review conversation" when neither exists (source "fallback")
export function buildAiVoiceCallSummary(input: AiVoiceSummaryInput): AiVoiceCallSummary {
  const reason = clean(input.capturedReason) || null;
  const preferredTime = clean(input.capturedPreferredTime) || null;
  const summary = clean(input.summaryHeadline);
  const safetyConcern = input.safetySignal === true;

  if (summary.length > 0) {
    return { headline: summary, reason, preferredTime, safetyConcern, source: "ai_summary" };
  }

  if (reason) {
    const parts = [reason];
    if (preferredTime) parts.push(preferredTime);
    return {
      headline: parts.join(" · "),
      reason,
      preferredTime,
      safetyConcern,
      source: "reason",
    };
  }

  return {
    headline: AI_VOICE_REVIEW_FALLBACK,
    reason,
    preferredTime,
    safetyConcern,
    source: "fallback",
  };
}
