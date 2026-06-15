import {
  workspaceSectionForCard,
  type PatientRequestCard,
} from "../../app/workspace/_components/workspace-types";

export const WORKSPACE_FRESHNESS_POLL_MS = 60_000;

export type WorkspaceFreshnessSnapshot = {
  latestActivityAt: string | null;
  needsFollowUpCount: number;
  handledCount: number;
  blockedCount: number;
  changedCount: number;
};

function timestampMs(value: string | null | undefined): number {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

export function buildWorkspaceFreshnessFromCards(cards: PatientRequestCard[]): WorkspaceFreshnessSnapshot {
  let latestActivityMs = 0;
  let needsFollowUpCount = 0;
  let handledCount = 0;
  let blockedCount = 0;

  for (const card of cards) {
    latestActivityMs = Math.max(latestActivityMs, timestampMs(card.lastActivityAt));
    const section = workspaceSectionForCard(card.flags);
    if (section === "blocked") blockedCount += 1;
    else if (section === "handled") handledCount += 1;
    else needsFollowUpCount += 1;
  }

  return {
    latestActivityAt: latestActivityMs > 0 ? new Date(latestActivityMs).toISOString() : null,
    needsFollowUpCount,
    handledCount,
    blockedCount,
    changedCount: 0,
  };
}

export function hasWorkspaceFreshnessChanged(
  baseline: WorkspaceFreshnessSnapshot,
  next: WorkspaceFreshnessSnapshot,
): boolean {
  if (next.changedCount > 0) return true;
  if (timestampMs(next.latestActivityAt) > timestampMs(baseline.latestActivityAt)) return true;
  return (
    next.needsFollowUpCount !== baseline.needsFollowUpCount ||
    next.handledCount !== baseline.handledCount ||
    next.blockedCount !== baseline.blockedCount
  );
}
