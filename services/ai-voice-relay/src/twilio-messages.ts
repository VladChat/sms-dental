// Twilio ConversationRelay WebSocket message contracts (inbound from Twilio +
// outbound to Twilio) and the `setup` authentication check.
//
// Provider contract reference (verify before broad launch — provider event
// shapes can change without notice):
// https://www.twilio.com/docs/voice/twiml/connect/conversationrelay#websocket-messages
//
// We never store raw Twilio messages, audio, or transcripts. These schemas
// validate just enough of each message to act safely and ignore everything else.

import { z } from "zod";
import { verifyRelayToken, type RelayTokenPayload } from "./shared-lib";

// ----------------------------------------------------------- inbound schemas

// `setup` — sent once when the session opens. customParameters carries the
// <Parameter> values we put in the TwiML (clinicId/callSid/from/to/token).
export const SetupMessageSchema = z
  .object({
    type: z.literal("setup"),
    sessionId: z.string().optional(),
    callSid: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    direction: z.string().optional(),
    customParameters: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
export type SetupMessage = z.infer<typeof SetupMessageSchema>;

// `prompt` — speech-to-text result. `voicePrompt` holds the transcribed text;
// `last` is true on the final (complete) chunk of an utterance.
export const PromptMessageSchema = z
  .object({
    type: z.literal("prompt"),
    voicePrompt: z.string().optional(),
    lang: z.string().optional(),
    last: z.boolean().optional(),
  })
  .passthrough();
export type PromptMessage = z.infer<typeof PromptMessageSchema>;

export const DtmfMessageSchema = z
  .object({
    type: z.literal("dtmf"),
    digit: z.string().optional(),
    digits: z.string().optional(),
  })
  .passthrough();
export type DtmfMessage = z.infer<typeof DtmfMessageSchema>;

export const InterruptMessageSchema = z
  .object({ type: z.literal("interrupt") })
  .passthrough();

export const ErrorMessageSchema = z
  .object({ type: z.literal("error"), description: z.string().optional() })
  .passthrough();

// Parse an inbound frame into a known shape, or null. Never throws.
export function parseInboundMessage(raw: unknown):
  | { kind: "setup"; message: SetupMessage }
  | { kind: "prompt"; message: PromptMessage }
  | { kind: "dtmf"; message: DtmfMessage }
  | { kind: "interrupt" }
  | { kind: "error"; description: string | null }
  | { kind: "unknown"; type: string | null } {
  if (typeof raw !== "object" || raw === null) return { kind: "unknown", type: null };
  const type = (raw as { type?: unknown }).type;
  switch (type) {
    case "setup": {
      const p = SetupMessageSchema.safeParse(raw);
      return p.success ? { kind: "setup", message: p.data } : { kind: "unknown", type: "setup" };
    }
    case "prompt": {
      const p = PromptMessageSchema.safeParse(raw);
      return p.success ? { kind: "prompt", message: p.data } : { kind: "unknown", type: "prompt" };
    }
    case "dtmf": {
      const p = DtmfMessageSchema.safeParse(raw);
      return p.success ? { kind: "dtmf", message: p.data } : { kind: "unknown", type: "dtmf" };
    }
    case "interrupt":
      return { kind: "interrupt" };
    case "error": {
      const p = ErrorMessageSchema.safeParse(raw);
      return { kind: "error", description: p.success ? p.data.description ?? null : null };
    }
    default:
      return { kind: "unknown", type: typeof type === "string" ? type : null };
  }
}

// ----------------------------------------------------------- outbound frames

export type OutboundTextMessage = {
  type: "text";
  token: string;
  last: boolean;
  interruptible: boolean;
};

export type OutboundEndMessage = { type: "end"; handoffData: string };

export function textMessage(
  token: string,
  opts?: { last?: boolean; interruptible?: boolean },
): OutboundTextMessage {
  return {
    type: "text",
    token,
    last: opts?.last ?? true,
    interruptible: opts?.interruptible ?? true,
  };
}

export function endMessage(handoffData: string): OutboundEndMessage {
  return { type: "end", handoffData };
}

// ---------------------------------------------------- setup authentication

export type SetupValidationResult =
  | {
      ok: true;
      payload: RelayTokenPayload;
      customParameters: { clinicId: string; callSid: string; from: string; to: string };
    }
  | { ok: false; reason: string };

// Authenticate a `setup` message: it must carry a valid, unexpired signed token
// in customParameters, AND the clinicId/callSid/from/to customParameters must
// match the signed token (defense in depth against a tampered parameter).
export function validateConversationRelaySetup(
  message: unknown,
  opts: { secret: string; now?: number; maxAgeMs?: number },
): SetupValidationResult {
  const parsed = SetupMessageSchema.safeParse(message);
  if (!parsed.success) return { ok: false, reason: "invalid_setup_message" };

  const cp = parsed.data.customParameters ?? {};
  const token = cp.token;
  if (!token) return { ok: false, reason: "missing_token" };

  const verified = verifyRelayToken(token, opts.secret, {
    now: opts.now,
    maxAgeMs: opts.maxAgeMs,
  });
  if (!verified.ok) return { ok: false, reason: `token_${verified.reason}` };

  const customParameters = {
    clinicId: cp.clinicId ?? "",
    callSid: cp.callSid ?? "",
    from: cp.from ?? "",
    to: cp.to ?? "",
  };

  if (
    customParameters.clinicId !== verified.payload.clinicId ||
    customParameters.callSid !== verified.payload.callSid ||
    customParameters.from !== verified.payload.from ||
    customParameters.to !== verified.payload.to
  ) {
    return { ok: false, reason: "customparameters_mismatch" };
  }

  return { ok: true, payload: verified.payload, customParameters };
}
