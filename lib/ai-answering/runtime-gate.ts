// AI Answering runtime gate — PURE decision function.
//
// Given the current runtime mode plus safe routing facts, decide whether a
// FUTURE AI voice runtime would be allowed to answer a call. This module:
//   - makes NO database calls,
//   - makes NO provider calls (Twilio / OpenAI),
//   - sends NO SMS and changes NO SMS-recovery decision,
//   - returns only safe metadata (booleans, a stable reason code, the mode).
//
// It is intentionally NOT wired into the live Twilio webhook path in this task.
// In "disabled" mode it always blocks, so importing it can never change current
// production voice routing. The next agent that builds a real runtime imports
// this to fail closed before touching any provider.

import { isValidE164, normalizePhone } from "../phone/normalize";
import type { AiAnsweringRuntimeMode } from "./runtime-config";

// Routing status of the called clinic number, when known. Only "active" (or an
// unknown/omitted status) is potentially routable; a number scheduled for
// removal or already removed must never answer.
export type AiAnsweringNumberRoutingStatus = "active" | "scheduled" | "removed" | "unknown";

export type AiAnsweringRuntimeGateInput = {
  mode: AiAnsweringRuntimeMode;
  clinicId: string | null | undefined;
  // When explicitly false, the clinic is inactive and is blocked. Unknown
  // (undefined) does not by itself authorize anything — the mode gate still
  // applies.
  clinicActive?: boolean;
  // Informational only. AI Answering is independent of the SMS recovery gate,
  // so this never changes the decision; it is accepted so a future caller can
  // log it alongside the decision.
  clinicSmsRecoveryEnabled?: boolean;
  callerPhone: string | null | undefined;
  clinicPhone?: string | null | undefined;
  numberRoutingStatus?: AiAnsweringNumberRoutingStatus;
  // Allowlists (only consulted in "test_only" mode).
  testClinicIds?: string[];
  testCallerNumbers?: string[];
  // Optional Twilio call context (accepted for future use / logging only).
  callStatus?: string | null;
  callDirection?: string | null;
};

export type AiAnsweringRuntimeDecisionReason =
  | "ai_answering_disabled"
  | "missing_clinic"
  | "clinic_inactive"
  | "invalid_caller_phone"
  | "number_not_routable"
  | "clinic_not_allowlisted"
  | "caller_not_allowlisted"
  | "allowed_test_only";

export type AiAnsweringRuntimeDecision = {
  ok: boolean;
  reason: AiAnsweringRuntimeDecisionReason;
  mode: AiAnsweringRuntimeMode;
  // Safe metadata only — never a raw phone, provider id, or secret.
  meta: {
    clinicAllowlisted: boolean;
    callerAllowlisted: boolean;
    numberRoutable: boolean;
  };
};

function block(
  mode: AiAnsweringRuntimeMode,
  reason: AiAnsweringRuntimeDecisionReason,
  meta: AiAnsweringRuntimeDecision["meta"],
): AiAnsweringRuntimeDecision {
  return { ok: false, reason, mode, meta };
}

// Decide whether the runtime may answer. Fails closed: any missing/invalid
// input or non-allowlisted target blocks. Only an explicit "test_only" mode
// with BOTH the clinic id and caller number allowlisted returns ok: true.
export function evaluateAiAnsweringRuntimeGate(
  input: AiAnsweringRuntimeGateInput,
): AiAnsweringRuntimeDecision {
  const clinicId = (input.clinicId ?? "").trim().toLowerCase();
  const callerPhone = normalizePhone(input.callerPhone);
  const routingStatus = input.numberRoutingStatus ?? "unknown";
  const numberRoutable = routingStatus === "active" || routingStatus === "unknown";

  const testClinicIds = (input.testClinicIds ?? []).map((value) => value.trim().toLowerCase());
  const testCallerNumbers = (input.testCallerNumbers ?? []).map((value) => normalizePhone(value));
  const clinicAllowlisted = clinicId.length > 0 && testClinicIds.includes(clinicId);
  const callerAllowlisted = isValidE164(callerPhone) && testCallerNumbers.includes(callerPhone);

  const meta: AiAnsweringRuntimeDecision["meta"] = {
    clinicAllowlisted,
    callerAllowlisted,
    numberRoutable,
  };

  // 1. Disabled mode always blocks — this is the production default.
  if (input.mode === "disabled") {
    return block("disabled", "ai_answering_disabled", meta);
  }

  // 2. A clinic must be identified.
  if (clinicId.length === 0) {
    return block(input.mode, "missing_clinic", meta);
  }

  // 3. An explicitly inactive clinic is blocked (before any allowlist check).
  if (input.clinicActive === false) {
    return block(input.mode, "clinic_inactive", meta);
  }

  // 4. The caller phone must be a valid E.164 number.
  if (!isValidE164(callerPhone)) {
    return block(input.mode, "invalid_caller_phone", meta);
  }

  // 5. A scheduled/removed number is never routable.
  if (!numberRoutable) {
    return block(input.mode, "number_not_routable", meta);
  }

  // 6. test_only: require BOTH the clinic id and caller number on the allowlists.
  if (!clinicAllowlisted) {
    return block(input.mode, "clinic_not_allowlisted", meta);
  }
  if (!callerAllowlisted) {
    return block(input.mode, "caller_not_allowlisted", meta);
  }

  return { ok: true, reason: "allowed_test_only", mode: input.mode, meta };
}
