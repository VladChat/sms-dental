import type { FrontDeskConversation } from "../db/front-desk";
import {
  buildAiVoiceCallSummary,
  deriveWorkspaceSourceChannel,
} from "./ai-voice-summary";
import { normalizeWorkspaceDisplayName } from "./display-name";
import { buildWorkspaceRequestSummary } from "./request-summary";
import {
  applyFlagsToStatus,
  deriveWorkspaceStatus,
  workspaceStatusForOutcome,
  type PatientRequestCard,
  type WorkspaceAiVoiceSummary,
  type WorkspaceCardChip,
} from "../../app/workspace/_components/workspace-types";

// Shared front-desk/admin-safe mapping for a clinic conversation. This keeps
// Workspace and the platform-admin patient request preview from drifting apart.
export function toPatientRequestCard(c: FrontDeskConversation): PatientRequestCard {
  const timeline = c.messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    at: m.createdAt.toISOString(),
  }));
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  const hasAiVoice = c.aiVoiceSessionId !== null;
  const aiVoiceSummary = hasAiVoice
    ? buildAiVoiceCallSummary({
        status: c.aiVoiceStatus ?? "incomplete",
        capturedReason: c.aiVoiceCapturedReason,
        capturedPreferredTime: c.aiVoiceCapturedPreferredTime,
        summaryHeadline: c.aiVoiceSummaryHeadline,
        safetySignal: c.aiVoiceSafetySignal,
      })
    : null;
  const aiSummaryHeadline =
    aiVoiceSummary && aiVoiceSummary.source !== "fallback" ? aiVoiceSummary.headline : null;

  const summary = buildWorkspaceRequestSummary({
    inboundTexts: c.messages.filter((m) => m.direction === "inbound").map((m) => m.body),
    safetyNoticeSent: c.smsSafetyNoticeSentAt !== null,
    aiSummary: aiSummaryHeadline,
  });

  const smsName = normalizeWorkspaceDisplayName(c.patientDisplayName);
  const aiName = c.aiVoiceCapturedName ? normalizeWorkspaceDisplayName(c.aiVoiceCapturedName) : null;
  const patientName = smsName ?? aiName;

  const aiVoice: WorkspaceAiVoiceSummary | null = aiVoiceSummary
    ? {
        summaryHeadline: aiVoiceSummary.source === "fallback" ? null : aiVoiceSummary.headline,
        reason: aiVoiceSummary.reason,
        preferredTime: aiVoiceSummary.preferredTime,
        safetyConcern: aiVoiceSummary.safetyConcern,
        handoffNote: (c.aiVoiceHandoffNote ?? "").trim() || null,
        capturedAt: (c.aiVoiceCompletedAt ?? c.aiVoiceCreatedAt)?.toISOString() ?? null,
      }
    : null;

  const smsActivityMs = (c.lastMessageAt ?? c.createdAt).getTime();
  const aiActivityMs = c.aiVoiceCompletedAt?.getTime() ?? c.aiVoiceCreatedAt?.getTime() ?? 0;
  const lastActivityIso = new Date(Math.max(smsActivityMs, aiActivityMs)).toISOString();

  const now = Date.now();
  const flags = {
    safetyConcern:
      summary.requestCategory === "Pain / urgent concern" ||
      summary.chips.some((chip) => chip.id === "pain_urgent") ||
      (aiVoice?.safetyConcern ?? false),
    automationPaused:
      c.automationMutedUntil !== null && c.automationMutedUntil.getTime() > now,
    highVolume: c.highVolumeFlaggedAt !== null,
    blocked: c.isBlocked,
    archived: c.workspaceArchivedAt !== null,
    handled: c.workspaceHandledAt !== null,
  };

  const summaryChips: WorkspaceCardChip[] = [
    ...(flags.automationPaused
      ? [{ id: "automation_paused", label: "Automation paused" } as WorkspaceCardChip]
      : []),
    ...(flags.highVolume
      ? [{ id: "high_volume", label: "High volume" } as WorkspaceCardChip]
      : []),
  ];
  const baseStatus =
    workspaceStatusForOutcome(c.frontDeskOutcome) ??
    deriveWorkspaceStatus(c.dbStatus, timeline);

  return {
    id: c.id,
    callerPhone: c.patientPhone,
    patientName,
    summaryHeadline: summary.headline,
    summaryChips,
    latestMessage: latest?.body ?? null,
    latestMessageDirection: latest?.direction ?? null,
    status: applyFlagsToStatus(flags, baseStatus),
    baseStatus,
    flags,
    sourceChannel: deriveWorkspaceSourceChannel({
      hasSms: timeline.length > 0,
      hasAiVoice,
    }),
    aiVoice,
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: lastActivityIso,
    workspaceArchivedAt: c.workspaceArchivedAt ? c.workspaceArchivedAt.toISOString() : null,
    workspaceHandledAt: c.workspaceHandledAt ? c.workspaceHandledAt.toISOString() : null,
    blockedAt: c.blockedAt ? c.blockedAt.toISOString() : null,
    timeline,
    frontDeskOutcome: c.frontDeskOutcome,
    frontDeskNote: c.frontDeskNote,
    frontDeskOutcomeAt: c.frontDeskOutcomeAt ? c.frontDeskOutcomeAt.toISOString() : null,
  };
}
