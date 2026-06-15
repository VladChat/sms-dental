export const AI_VOICE_TRANSCRIPT_RETENTION_DAYS = 90;
export const AI_VOICE_TRANSCRIPT_MAX_TURNS = 80;
export const AI_VOICE_TRANSCRIPT_TURN_TEXT_LIMIT = 600;

export type AiVoiceTranscriptSpeaker = "patient" | "ai";

export type AiVoiceTranscriptTurn = {
  speaker: AiVoiceTranscriptSpeaker;
  text: string;
  sequence: number;
  at: string | null;
};

function normalizeSpeaker(value: unknown): AiVoiceTranscriptSpeaker | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "patient" || normalized === "user" || normalized === "caller") {
    return "patient";
  }
  if (normalized === "ai" || normalized === "assistant") return "ai";
  return null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  return text.slice(0, AI_VOICE_TRANSCRIPT_TURN_TEXT_LIMIT);
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  return date.toISOString();
}

export function normalizeAiVoiceTranscriptTurns(input: unknown): AiVoiceTranscriptTurn[] {
  if (!Array.isArray(input)) return [];

  const turns: AiVoiceTranscriptTurn[] = [];
  for (const item of input) {
    if (turns.length >= AI_VOICE_TRANSCRIPT_MAX_TURNS) break;
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const speaker = normalizeSpeaker(record.speaker ?? record.role);
    const text = normalizeText(record.text);
    if (!speaker || !text) continue;

    turns.push({
      speaker,
      text,
      sequence: turns.length + 1,
      at: normalizeTimestamp(record.at ?? record.timestamp ?? record.createdAt),
    });
  }

  return turns;
}

export function transcriptExpiresAtFrom(base: Date = new Date()): Date {
  return new Date(base.getTime() + AI_VOICE_TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
