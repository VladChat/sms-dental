// AI Answering runtime mode — SERVER-ONLY, OFF BY DEFAULT.
//
// Reads the runtime mode lazily from the environment. The default is always
// "disabled" when the env var is missing, empty, or invalid. Nothing here runs
// at import time, throws, logs secrets, or exposes env values to the client.
// Public/client code MUST NOT import this module.
//
// This does NOT enable live AI answering. There is intentionally NO "live" mode
// in this foundation. The only non-disabled mode is "test_only", which still
// requires BOTH the clinic id and the caller number to be on explicit
// allowlists (see lib/ai-answering/runtime-gate.ts). It exists so a future
// real runtime can be exercised against a single known test clinic/caller
// without ever answering a real patient's call.

import { parsePhoneNumberList } from "../env";
import { normalizePhone } from "../phone/normalize";

export const AI_ANSWERING_RUNTIME_MODES = ["disabled", "test_only"] as const;
export type AiAnsweringRuntimeMode = (typeof AI_ANSWERING_RUNTIME_MODES)[number];

export type AiAnsweringRuntimeConfig = {
  mode: AiAnsweringRuntimeMode;
  // Allowlisted clinic UUIDs (trimmed + lowercased). Only meaningful when the
  // mode is "test_only"; ignored when "disabled".
  testClinicIds: string[];
  // Allowlisted caller numbers normalized to E.164. Only meaningful when the
  // mode is "test_only"; ignored when "disabled".
  testCallerNumbers: string[];
};

// Parse the mode string. Anything other than the exact "test_only" token —
// including unset, empty, "live", or a typo — falls back to "disabled".
function parseMode(raw: string | undefined): AiAnsweringRuntimeMode {
  return raw?.trim() === "test_only" ? "test_only" : "disabled";
}

// Comma-separated clinic id allowlist. Trimmed + lowercased; empty entries
// dropped. Never throws.
export function parseClinicIdList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

// Lazy, non-cached read so config changes (and tests) take effect immediately.
// Always returns a fully-populated, safe object — never throws and never logs.
export function getAiAnsweringRuntimeConfig(): AiAnsweringRuntimeConfig {
  const mode = parseMode(process.env.AI_ANSWERING_RUNTIME_MODE);
  const testClinicIds = parseClinicIdList(process.env.AI_ANSWERING_TEST_CLINIC_IDS);
  const testCallerNumbers = parsePhoneNumberList(process.env.AI_ANSWERING_TEST_CALLER_NUMBERS)
    .map((value) => normalizePhone(value))
    .filter((value) => value.length > 0);
  return { mode, testClinicIds, testCallerNumbers };
}

// Convenience: true only when the runtime is in "test_only" mode. Even when
// true, every runtime decision still flows through the pure gate, so this alone
// never authorizes answering a call.
export function isAiAnsweringRuntimeEnabled(): boolean {
  return getAiAnsweringRuntimeConfig().mode !== "disabled";
}
