import type { AiVoiceSessionStatus } from "../../config/ai-answering.config";
import {
  normalizeAiVoiceTranscriptTurns,
  type AiVoiceTranscriptTurn,
} from "../ai-answering/transcript";
import { buildAiVoiceCallSummary } from "./ai-voice-summary";

export type AiVoiceSessionHistoryRow = {
  id: string;
  status: AiVoiceSessionStatus;
  summaryHeadline: string | null;
  capturedReason: string | null;
  capturedPreferredTime: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
  completedAt: Date | null;
  createdAt: Date;
  transcriptTurns: unknown;
  transcriptExpiresAt: Date | null;
};

export type WorkspaceAiVoiceHistoryItem = {
  id: string;
  callCapturedAt: string;
  request: string | null;
  preferredTime: string | null;
  callSummary: string | null;
  handoffNote: string | null;
  safetyConcern: boolean;
  transcriptTurns: AiVoiceTranscriptTurn[];
};

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toWorkspaceAiVoiceHistoryItem(
  row: AiVoiceSessionHistoryRow,
): WorkspaceAiVoiceHistoryItem {
  const derived = buildAiVoiceCallSummary({
    status: row.status,
    capturedReason: row.capturedReason,
    capturedPreferredTime: row.capturedPreferredTime,
    summaryHeadline: row.summaryHeadline,
    safetySignal: row.safetySignal,
  });
  const callSummary =
    clean(row.summaryHeadline) ?? (derived.source === "fallback" ? null : derived.headline);

  return {
    id: row.id,
    callCapturedAt: (row.completedAt ?? row.createdAt).toISOString(),
    request: clean(row.capturedReason),
    preferredTime: clean(row.capturedPreferredTime),
    callSummary,
    handoffNote: clean(row.handoffNote),
    safetyConcern: row.safetySignal === true,
    transcriptTurns: normalizeAiVoiceTranscriptTurns(row.transcriptTurns),
  };
}
