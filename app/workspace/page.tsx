import type { Metadata } from "next";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import {
  listClinicConversations,
  type FrontDeskConversation,
} from "../../lib/db/front-desk";
import { resolveAuthClinicAccess } from "../../lib/auth/access";
import { buildWorkspaceRequestSummary } from "../../lib/workspace/request-summary";
import { normalizeWorkspaceDisplayName } from "../../lib/workspace/display-name";
import {
  buildAiVoiceCallSummary,
  deriveWorkspaceSourceChannel,
} from "../../lib/workspace/ai-voice-summary";
import { Workspace } from "./_components/Workspace";
import {
  deriveWorkspaceStatus,
  applyFlagsToStatus,
  workspaceStatusForOutcome,
  type PatientRequestCard,
  type WorkspaceAiVoiceSummary,
  type WorkspaceCardChip,
} from "./_components/workspace-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Patient requests — Missed Calls Dental",
  description: "Review office-ready patient requests built from missed-call replies.",
  robots: { index: false, follow: false },
};

// Map a front-desk-safe conversation into a UI card. The summary headline and
// chips come from deterministic keyword derivation over INBOUND text only —
// never invented, never generative. When an AI answered call session exists, its
// safe stored summary (also deterministic — no live AI runtime) flows in through
// buildWorkspaceRequestSummary's aiSummary hook and the AI call summary card. The
// name is sanitized: request-like phrases stored as a display name render as
// "Not provided" instead of a fake name; a safe AI-captured name is a fallback.
function toCard(c: FrontDeskConversation): PatientRequestCard {
  const timeline = c.messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    at: m.createdAt.toISOString(),
  }));
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  // AI answered call session (if any). Build the safe summary first so it can
  // drive the request headline, the name fallback, and the safety flag.
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
  // Only a meaningful AI headline overrides the deterministic SMS summary; a
  // bare "Review conversation" fallback never clobbers a real SMS-derived line.
  const aiSummaryHeadline =
    aiVoiceSummary && aiVoiceSummary.source !== "fallback" ? aiVoiceSummary.headline : null;

  const summary = buildWorkspaceRequestSummary({
    inboundTexts: c.messages.filter((m) => m.direction === "inbound").map((m) => m.body),
    safetyNoticeSent: c.smsSafetyNoticeSentAt !== null,
    aiSummary: aiSummaryHeadline,
  });

  // Prefer an already-saved display name; otherwise fall back to a safe AI
  // captured name (sanitized through the conservative extractor).
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

  // Last activity uses the newer of the SMS activity and the AI call time, so an
  // AI-only request surfaces in Needs follow-up instead of being buried.
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
  // Visible chips are reserved for non-redundant system state. Request signals
  // such as pain/payment/insurance live in the one-line summary instead.
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

// `/workspace` is the front-desk operational view. It shows only front-desk-safe
// patient-request data — never owner/admin setup, billing, compliance, or Twilio
// details. Access prefers real authenticated session + clinic membership, with a
// temporary setup-token fallback kept only to avoid lockouts during auth rollout.
export default async function WorkspacePage() {
  // Primary access path: authenticated owner/front-desk membership.
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    const conversations = await listClinicConversations(access.clinic.id).catch(() => []);
    return <Workspace cards={conversations.map(toCard)} />;
  }

  // Temporary legacy fallback: setup-token cookie for existing preview users.
  const token = await readAccountSessionToken();
  if (!token) return <WorkspaceGate signedOut />;

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) return <WorkspaceGate signedOut />;

  const setupRequest = lookup.setupRequest;
  if (!setupRequest.clinic_id) return <WorkspaceGate needsSetup />;

  const clinic = await findClinicById(setupRequest.clinic_id);
  if (!clinic) return <WorkspaceGate />;

  const conversations = await listClinicConversations(clinic.id).catch(() => []);
  return <Workspace cards={conversations.map(toCard)} />;
}

function WorkspaceGate({
  needsSetup = false,
  signedOut = false,
}: {
  needsSetup?: boolean;
  signedOut?: boolean;
}) {
  return (
    <main className="ws-page">
      <section className="card card-pad" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 className="t-h3">Patient requests</h1>
        <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
          {needsSetup
            ? "Finish your account setup to start receiving patient requests."
            : signedOut
              ? "Please sign in to access patient requests."
              : "Please open your account link to access patient requests."}
        </p>
        <p style={{ marginTop: "var(--space-5)" }}>
          <a
            className="link"
            href={needsSetup ? "/account" : signedOut ? "/login" : "https://missedcallsdental.com/"}
          >
            {needsSetup ? "Go to your account →" : signedOut ? "Go to sign in →" : "Request a new setup link →"}
          </a>
        </p>
      </section>
    </main>
  );
}
