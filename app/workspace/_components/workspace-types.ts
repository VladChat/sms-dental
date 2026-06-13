// Shared types + pure helpers for the front-desk workspace. No runtime side
// effects, so both the server page and the client component import these.

import type { FrontDeskOutcome } from "../../../lib/workspace/outcome";

export type WorkspaceStatus =
  | "new"
  | "needs_follow_up"
  | "waiting_for_patient"
  | "ready_to_call"
  | "booked"
  | "closed"
  | "no_appointment_booked"
  | "could_not_reach_patient"
  | "handled"
  | "archived"
  | "blocked";

export type WorkspaceTimelineItem = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  at: string; // ISO timestamp
};

// Secondary flags shown alongside the primary status. Derived only — never
// guessed: safety from classification/state, the rest from real columns.
export type WorkspaceCardFlags = {
  safetyConcern: boolean;
  automationPaused: boolean;
  highVolume: boolean;
  blocked: boolean;
  archived: boolean;
  handled: boolean;
};

// Visible queue sections. Archived remains a stored compatibility state, but it
// is not a customer-facing section.
export type WorkspaceSectionId =
  | "needs_follow_up"
  | "handled"
  | "blocked";

export type WorkspaceCardChip = {
  id: "automation_paused" | "high_volume";
  label: string;
};

// The front-desk-safe view of a patient request. The summary headline and
// chips are derived deterministically from inbound text and conversation
// state (lib/workspace/request-summary.ts) — never invented or AI-generated.
export type PatientRequestCard = {
  // Opaque key for React/selection only. Not an internal ID shown to the user.
  id: string;
  callerPhone: string;
  // Sanitized display name (normalizeWorkspaceDisplayName); null renders as
  // "Not provided" — request-like phrases are never shown as a name.
  patientName: string | null;
  // One short scannable line ("Cleaning appointment · Tomorrow" or
  // "Review conversation").
  summaryHeadline: string;
  // Signal chips only — never empty "None detected"-style placeholders.
  summaryChips: WorkspaceCardChip[];
  latestMessage: string | null;
  latestMessageDirection: "inbound" | "outbound" | null;
  status: WorkspaceStatus;
  // Status without block/archive/handled precedence — used by the client to
  // recompute `status` after queue actions without re-deriving from the DB.
  baseStatus: WorkspaceStatus;
  flags: WorkspaceCardFlags;
  createdAt: string; // ISO
  lastActivityAt: string; // ISO
  workspaceArchivedAt?: string | null; // ISO
  workspaceHandledAt?: string | null; // ISO
  blockedAt?: string | null; // ISO
  timeline: WorkspaceTimelineItem[];
  // True only for UI-only demo cards rendered when no real conversations exist.
  isSample?: boolean;
  // Optional sample note shown in the detail view.
  sampleNote?: string | null;
  // Saved front-desk outcome for real cards (undefined/null for samples and
  // for real cards with no recorded result yet).
  frontDeskOutcome?: FrontDeskOutcome | null;
  frontDeskNote?: string | null;
  frontDeskOutcomeAt?: string | null; // ISO
};

export const NO_FLAGS: WorkspaceCardFlags = {
  safetyConcern: false,
  automationPaused: false,
  highVolume: false,
  blocked: false,
  archived: false,
  handled: false,
};

// Primary status precedence: Blocked > Handled > Archived > saved outcome >
// timeline-derived needs-follow-up / waiting-for-patient.
export function applyFlagsToStatus(
  flags: Pick<WorkspaceCardFlags, "blocked" | "archived" | "handled">,
  baseStatus: WorkspaceStatus,
): WorkspaceStatus {
  if (flags.blocked) return "blocked";
  if (flags.handled) return "handled";
  if (flags.archived) return "archived";
  return baseStatus;
}

export function derivePrimaryWorkspaceStatus(input: {
  flags: Pick<WorkspaceCardFlags, "blocked" | "archived" | "handled">;
  outcome: FrontDeskOutcome | null | undefined;
  dbStatus: string;
  timeline: { direction: "inbound" | "outbound" }[];
}): WorkspaceStatus {
  return applyFlagsToStatus(
    input.flags,
    workspaceStatusForOutcome(input.outcome) ??
      deriveWorkspaceStatus(input.dbStatus, input.timeline),
  );
}

// Queue section membership. Blocked wins, handled second, and every other
// conversation stays in Needs follow-up. Archived-only legacy conversations
// remain reachable instead of falling into a hidden state.
export function workspaceSectionForCard(
  flags: Pick<WorkspaceCardFlags, "blocked" | "archived" | "handled">,
): WorkspaceSectionId {
  if (flags.blocked) return "blocked";
  if (flags.handled) return "handled";
  return "needs_follow_up";
}

function timestampMs(iso: string | null | undefined): number {
  const ms = Date.parse(iso ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

function sectionSortTimestamp(sectionId: WorkspaceSectionId, card: PatientRequestCard): number {
  if (sectionId === "blocked") return timestampMs(card.blockedAt ?? card.lastActivityAt);
  if (sectionId === "handled") {
    return timestampMs(card.workspaceHandledAt ?? card.frontDeskOutcomeAt ?? card.lastActivityAt);
  }
  return timestampMs(card.lastActivityAt);
}

export function sortWorkspaceSectionCards(
  sectionId: WorkspaceSectionId,
  cards: PatientRequestCard[],
): PatientRequestCard[] {
  const direction = sectionId === "needs_follow_up" ? 1 : -1;
  return [...cards].sort((a, b) => {
    const sectionDelta =
      (sectionSortTimestamp(sectionId, a) - sectionSortTimestamp(sectionId, b)) * direction;
    if (sectionDelta !== 0) return sectionDelta;

    const activityDelta = (timestampMs(a.lastActivityAt) - timestampMs(b.lastActivityAt)) * direction;
    if (activityDelta !== 0) return activityDelta;
    return a.id.localeCompare(b.id);
  });
}

// Conservative status derivation from existing data only. We never guess beyond
// what the messages/lifecycle clearly support. `ready_to_call` is part of the
// vocabulary but is intentionally not auto-assigned yet (no reliable signal).
export function deriveWorkspaceStatus(
  dbStatus: string,
  timeline: { direction: "inbound" | "outbound" }[],
): WorkspaceStatus {
  if (dbStatus === "booked") return "booked";
  if (dbStatus === "closed" || dbStatus === "lost") return "closed";

  if (timeline.length === 0) return "needs_follow_up";
  const latest = timeline[timeline.length - 1];
  if (latest.direction === "inbound") return "needs_follow_up";
  return "waiting_for_patient";
}

// A saved front-desk outcome is the primary source of a real card's final
// status. Returns null when no outcome is saved, so the caller falls back to the
// conservative timeline/lifecycle derivation above.
export function workspaceStatusForOutcome(
  outcome: FrontDeskOutcome | null | undefined,
): WorkspaceStatus | null {
  switch (outcome) {
    case "appointment_booked":
      return "booked";
    case "no_appointment_booked":
      return "no_appointment_booked";
    case "could_not_reach_patient":
      return "could_not_reach_patient";
    default:
      return null;
  }
}

export function getLatestInboundTimelineItem(
  timeline: WorkspaceTimelineItem[],
): WorkspaceTimelineItem | null {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const item = timeline[i];
    if (item.direction === "inbound") return item;
  }
  return null;
}

export const WORKSPACE_STATUS_META: Record<
  WorkspaceStatus,
  { label: string; badge: string }
> = {
  new: { label: "Needs follow-up", badge: "badge-warning" },
  needs_follow_up: { label: "Needs follow-up", badge: "badge-warning" },
  waiting_for_patient: { label: "Needs follow-up", badge: "badge-warning" },
  ready_to_call: { label: "Ready to call", badge: "badge-brand" },
  booked: { label: "Appointment booked", badge: "badge-success" },
  closed: { label: "Closed", badge: "badge-neutral" },
  no_appointment_booked: { label: "No appointment booked", badge: "badge-neutral" },
  could_not_reach_patient: { label: "Could not reach patient", badge: "badge-neutral" },
  handled: { label: "Handled", badge: "badge-success" },
  archived: { label: "Archived", badge: "badge-neutral" },
  blocked: { label: "Blocked", badge: "badge-warning" },
};

// Secondary flag chips (safety/automation/volume) shown next to the status.
export const WORKSPACE_FLAG_META = {
  safetyConcern: { label: "Safety concern", badge: "badge-warning" },
  automationPaused: { label: "Automation paused", badge: "badge-neutral" },
  highVolume: { label: "High volume", badge: "badge-warning" },
} as const;

export const NOT_PROVIDED = "Not provided yet";

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
