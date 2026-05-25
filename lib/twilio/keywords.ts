// Detect the compliance keywords carriers and Twilio require us to honor in
// inbound SMS. Matching is case-insensitive and ignores surrounding whitespace
// and punctuation, mirroring the standard A2P/Twilio behavior.

export type SmsKeyword = "stop" | "start" | "help" | null;

// Common variants accepted by US carriers / Twilio Advanced Opt-Out.
const STOP_WORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
]);
const START_WORDS = new Set(["start", "unstop", "yes"]);
const HELP_WORDS = new Set(["help", "info"]);

export function detectSmsKeyword(body: string | undefined | null): SmsKeyword {
  if (!body) return null;
  const normalized = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!normalized) return null;
  if (STOP_WORDS.has(normalized)) return "stop";
  if (START_WORDS.has(normalized)) return "start";
  if (HELP_WORDS.has(normalized)) return "help";
  return null;
}
