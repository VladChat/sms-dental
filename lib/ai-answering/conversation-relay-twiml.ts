// Twilio ConversationRelay TwiML builder — SERVER-ONLY.
//
// Builds the <Connect><ConversationRelay> TwiML that hands a live call to the
// standalone relay service. ConversationRelay (not Media Streams) owns the
// phone/STT/TTS/session/WebSocket layer; this app only points it at our relay
// WebSocket and passes safe routing context as signed <Parameter> values.
//
// Safety invariants:
//   - the WebSocket URL must be wss:// (provided by server env/config);
//   - call context is authenticated with a short-lived HMAC-signed token
//     (see relay-token.ts) so the relay can reject forged/replayed sessions;
//   - the signing secret is NEVER placed in the TwiML — only the derived token;
//   - no transcript/audio/prompt or PCI/medical data is included anywhere;
//   - every attribute value is XML-escaped.
//
// Provider contract reference (verify before broad launch — provider XML can
// change): https://www.twilio.com/docs/voice/twiml/connect/conversationrelay

import { signRelayToken } from "./relay-token";

// Thrown when the relay configuration is unusable (missing/insecure WS URL or
// missing signing secret). Callers fail closed to the existing voice greeting.
export class ConversationRelayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationRelayConfigError";
  }
}

// Escape all five XML metacharacters for safe attribute/text content.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type BuildConversationRelayTwimlInput = {
  // wss:// URL of the relay service `/twilio/conversation-relay` endpoint.
  wsUrl: string;
  // HMAC signing secret shared with the relay service. Used to sign the token;
  // never emitted into the TwiML.
  signingSecret: string;
  clinicId: string;
  callSid: string;
  from: string;
  to: string;
  clinicName?: string | null;
  // Optional <Connect action="..."> URL. Omitted by default: when the relay
  // sends its `end` message the call simply hangs up (the capture flow needs no
  // follow-up TwiML). Provide one only if a post-session webhook is wired.
  actionUrl?: string | null;
  // Spoken language. US-first product default.
  language?: string;
  // Injectable clock for deterministic tests.
  now?: number;
};

// Short, clinic-branded greeting spoken by ConversationRelay before the
// WebSocket exchange begins. No PCI/medical content.
export function buildConversationRelayWelcomeGreeting(clinicName?: string | null): string {
  const name = (clinicName ?? "").trim();
  return `Hi, this is ${name.length > 0 ? name : "the dental office"}. How can we help you today?`;
}

// Build the ConversationRelay TwiML string (no XML prolog — pass to
// twimlResponse(), which adds it, exactly like buildMissedCallVoiceTwiml).
export function buildConversationRelayTwiml(input: BuildConversationRelayTwimlInput): string {
  if (!input.wsUrl || !input.wsUrl.startsWith("wss://")) {
    throw new ConversationRelayConfigError(
      "AI Answering relay WebSocket URL must be configured and start with wss://",
    );
  }
  if (!input.signingSecret) {
    throw new ConversationRelayConfigError("AI Answering relay signing secret is not configured");
  }

  const token = signRelayToken(
    {
      clinicId: input.clinicId,
      callSid: input.callSid,
      from: input.from,
      to: input.to,
      ts: input.now ?? Date.now(),
    },
    input.signingSecret,
  );

  const welcomeGreeting = buildConversationRelayWelcomeGreeting(input.clinicName);
  const language = input.language ?? "en-US";

  const parameters: Array<[string, string]> = [
    ["clinicId", input.clinicId],
    ["callSid", input.callSid],
    ["from", input.from],
    ["to", input.to],
    ["token", token],
  ];
  const parameterXml = parameters
    .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`)
    .join("");

  const connectAttrs = input.actionUrl ? ` action="${escapeXml(input.actionUrl)}"` : "";

  return (
    `<Response>` +
    `<Connect${connectAttrs}>` +
    `<ConversationRelay url="${escapeXml(input.wsUrl)}" ` +
    `welcomeGreeting="${escapeXml(welcomeGreeting)}" ` +
    `language="${escapeXml(language)}" ` +
    `interruptible="speech" ` +
    `reportInputDuringAgentSpeech="none">` +
    parameterXml +
    `</ConversationRelay>` +
    `</Connect>` +
    `</Response>`
  );
}
