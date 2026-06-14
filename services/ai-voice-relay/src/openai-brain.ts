// AI text brain for the relay — turns the caller's words into a short spoken
// reply plus the narrow captured request. The brain returns STRICT JSON that is
// validated with zod; invalid model output falls back to a safe reply and never
// completes a session from unvalidated data.
//
// Safety: the system instruction forbids diagnosis, treatment advice, medication
// instructions, and clinical triage; routes unknowns to the office; and reserves
// the 911 line for a possible medical emergency. It is grounded ONLY on the
// clinic's approved facts (lib/ai-answering/front-desk-context.ts). No OpenAI
// prompt or response is stored anywhere.

import { z } from "zod";
import {
  toRuntimeInstructionText,
  type AiFrontDeskRuntimeContext,
} from "./shared-lib";

// Strict shape the brain must return. Generous max lengths; the DB lifecycle
// re-trims to the stored column limits, so this only guards against runaway text.
export const BrainResultSchema = z.object({
  reply: z.string().min(1).max(600),
  capturedPatientName: z.string().max(160).nullable(),
  capturedReason: z.string().max(600).nullable(),
  capturedPreferredTime: z.string().max(200).nullable(),
  readyToComplete: z.boolean(),
  safetySignal: z.boolean(),
  handoffNote: z.string().max(600).nullable(),
});
export type BrainResult = z.infer<typeof BrainResultSchema>;

export type CapturedSoFar = {
  name: string | null;
  reason: string | null;
  preferredTime: string | null;
};

export type Turn = { role: "user" | "assistant"; text: string };

export type BrainTurnInput = {
  context: AiFrontDeskRuntimeContext | null;
  captured: CapturedSoFar;
  // Full in-memory conversation so far, ending with the latest caller turn.
  turns: Turn[];
};

export interface FrontDeskBrain {
  respond(input: BrainTurnInput): Promise<BrainResult>;
}

// Spoken reply used when the model is unavailable or returns invalid JSON. Safe,
// non-clinical, keeps the call moving toward capturing the message.
export const SAFE_FALLBACK_REPLY =
  "Sorry, I didn't quite catch that. Could you tell me your name and the reason for your call?";

export function safeFallbackResult(): BrainResult {
  return {
    reply: SAFE_FALLBACK_REPLY,
    capturedPatientName: null,
    capturedReason: null,
    capturedPreferredTime: null,
    readyToComplete: false,
    safetySignal: false,
    handoffNote: null,
  };
}

// Build the grounded, safety-bounded system instruction. Contains the fixed
// prohibitions and the approved-facts text; instructs strict JSON output.
export function buildSystemInstruction(context: AiFrontDeskRuntimeContext | null): string {
  const clinicName = context?.clinicName?.trim() || "the dental office";
  const facts = context
    ? toRuntimeInstructionText(context)
    : "Clinic: (name on file)\nAnything not listed: send to office.";

  return [
    `You are the virtual front-desk assistant for ${clinicName}, a dental office, answering a phone call.`,
    "Your only job is to take a short message so the office can follow up. Collect three things: the caller's NAME, the REASON for their call, and their PREFERRED day or time for a callback or appointment.",
    "",
    "How to talk:",
    "- This is a live phone call. Keep every reply short and natural, and ask only ONE question at a time.",
    "- Briefly introduce yourself as the office's assistant on your first reply.",
    "- Once you have the name, reason, and a preferred time, confirm briefly and stop asking questions.",
    "",
    "Strict safety rules (never break these):",
    "- Never provide a diagnosis.",
    "- Never give treatment advice.",
    "- Never give medication instructions.",
    "- Never perform medical or clinical triage.",
    "- If the caller mentions pain, swelling, bleeding, or any urgent concern: set safetySignal to true, tell them the office will follow up as soon as possible, and do NOT assess how serious it is.",
    '- If the caller describes a possible medical emergency, say exactly: "If this is a medical emergency, call 911."',
    "- If the caller asks something you do not know, or that is not in the approved office facts below, tell them the office can help with that and offer to take a message. Never invent hours, prices, services, insurance, or policies.",
    "",
    "Approved office facts (you may state these; never go beyond them):",
    facts,
    "",
    "Output format — respond with ONE minified JSON object and nothing else (no markdown, no code fences). It must have EXACTLY these keys:",
    '{"reply": string, "capturedPatientName": string|null, "capturedReason": string|null, "capturedPreferredTime": string|null, "readyToComplete": boolean, "safetySignal": boolean, "handoffNote": string|null}',
    '- "reply": what you will say next to the caller (short, spoken).',
    "- captured* fields: the best value gathered so far, or null if not known yet.",
    '- "readyToComplete": true ONLY when you have the reason AND at least the name or a preferred time, and have nothing else to ask.',
    '- "handoffNote": optional short internal note for the front desk (no medical advice); null if none.',
  ].join("\n");
}

// Pull plain text out of the JSON-or-fenced model output, then validate.
function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body.trim();
}

export function parseBrainResult(raw: string): { ok: true; value: BrainResult } | { ok: false } {
  if (!raw || raw.trim().length === 0) return { ok: false };
  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(raw));
  } catch {
    return { ok: false };
  }
  const parsed = BrainResultSchema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

// --------------------------------------------------------- OpenAI Responses API

// Minimal structural interface over the official OpenAI Node SDK's Responses
// API, so the real client and a test mock are interchangeable.
export type ResponsesCreateParams = {
  model: string;
  input: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_output_tokens?: number;
  text?: { format?: { type: string } };
};

export interface OpenAiResponsesClient {
  responses: {
    create(params: ResponsesCreateParams): Promise<{ output_text?: string } & Record<string, unknown>>;
  };
}

function extractResponseText(resp: { output_text?: string }): string {
  return typeof resp.output_text === "string" ? resp.output_text : "";
}

function buildMessages(input: BrainTurnInput): ResponsesCreateParams["input"] {
  const messages: ResponsesCreateParams["input"] = [
    { role: "system", content: buildSystemInstruction(input.context) },
  ];
  const captured = input.captured;
  if (captured.name || captured.reason || captured.preferredTime) {
    messages.push({
      role: "system",
      content:
        "Captured so far — name: " +
        `${captured.name ?? "unknown"}; reason: ${captured.reason ?? "unknown"}; ` +
        `preferred time: ${captured.preferredTime ?? "unknown"}. Do not re-ask for values already known.`,
    });
  }
  for (const turn of input.turns) {
    messages.push({ role: turn.role, content: turn.text });
  }
  return messages;
}

export function createOpenAiBrain(deps: {
  client: OpenAiResponsesClient;
  model: string;
  onError?: (message: string) => void;
}): FrontDeskBrain {
  return {
    async respond(input) {
      let raw = "";
      try {
        const resp = await deps.client.responses.create({
          model: deps.model,
          input: buildMessages(input),
          max_output_tokens: 400,
          text: { format: { type: "json_object" } },
        });
        raw = extractResponseText(resp);
      } catch (err) {
        deps.onError?.(err instanceof Error ? err.message : "openai_error");
        return safeFallbackResult();
      }
      const parsed = parseBrainResult(raw);
      if (!parsed.ok) {
        deps.onError?.("invalid_model_json");
        return safeFallbackResult();
      }
      return parsed.value;
    },
  };
}

// --------------------------------------------------- deterministic fallback

const URGENT_RE = /\b(pain|hurts?|hurting|swell(?:ing)?|bleed(?:ing)?|emergency|severe|broken|knocked out)\b/i;

// No-OpenAI brain for offline/local runs and tests. Walks name → reason →
// preferred time, capturing each caller turn into the next missing slot. Applies
// the same safety flag heuristic but never produces clinical advice.
export function createDeterministicBrain(): FrontDeskBrain {
  return {
    async respond(input) {
      const lastUser = [...input.turns].reverse().find((t) => t.role === "user");
      const text = (lastUser?.text ?? "").trim();
      const safetySignal = URGENT_RE.test(text);

      let { name, reason, preferredTime } = input.captured;
      let reply: string;
      let readyToComplete = false;

      if (!name) {
        name = text || null;
        reply = "Thanks. What's the reason for your call today?";
      } else if (!reason) {
        reason = text || null;
        reply = "Got it. What day or time works best for a callback?";
      } else if (!preferredTime) {
        preferredTime = text || null;
        readyToComplete = true;
        reply = "Thank you. I'll pass this along to the office.";
      } else {
        readyToComplete = true;
        reply = "Thank you. I'll pass this along to the office.";
      }

      if (safetySignal) {
        reply = `Thanks for letting me know — the office will follow up as soon as possible. ${reply}`;
      }

      return {
        reply,
        capturedPatientName: name,
        capturedReason: reason,
        capturedPreferredTime: preferredTime,
        readyToComplete,
        safetySignal,
        handoffNote: null,
      };
    },
  };
}
