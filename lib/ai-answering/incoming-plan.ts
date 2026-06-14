// Pure decision for the incoming voice webhook: should this call be handed to
// AI Answering (ConversationRelay) or fall through to the existing missed-call
// greeting? Keeping it pure (no DB, no provider, no env reads) makes the routing
// choice directly unit-testable and keeps the webhook handler thin.
//
// Fails closed: anything other than an exact allowlisted test_only match with a
// present relay configuration returns the existing-greeting path.

import {
  evaluateAiAnsweringRuntimeGate,
  type AiAnsweringRuntimeGateInput,
} from "./runtime-gate";

export type AiAnsweringIncomingDecision = {
  useConversationRelay: boolean;
  // Stable reason code for safe logging. Either a gate reason, the explicit
  // "relay_config_missing" fall-back, or "allowed_test_only" on success.
  reason: string;
};

export function decideAiAnsweringIncoming(input: {
  gate: AiAnsweringRuntimeGateInput;
  // Whether AI_ANSWERING_RELAY_WS_URL + AI_ANSWERING_RELAY_SIGNING_SECRET are
  // both configured (computed by the caller via getAiAnsweringRelayConfigSafe).
  relayConfigured: boolean;
}): AiAnsweringIncomingDecision {
  const decision = evaluateAiAnsweringRuntimeGate(input.gate);
  if (!decision.ok) {
    return { useConversationRelay: false, reason: decision.reason };
  }
  // Gate passed, but without relay config we cannot connect — fail closed to the
  // existing greeting so the call is never dropped.
  if (!input.relayConfigured) {
    return { useConversationRelay: false, reason: "relay_config_missing" };
  }
  return { useConversationRelay: true, reason: decision.reason };
}
