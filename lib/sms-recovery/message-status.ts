// Pure ordering logic for Twilio outbound message delivery statuses. Twilio can
// deliver status callbacks more than once and out of order; a later callback
// must never regress a more advanced status (e.g. "sent" arriving after
// "delivered").

const STATUS_RANK: Record<string, number> = {
  accepted: 1,
  scheduled: 1,
  queued: 2,
  sending: 3,
  sent: 4,
  // Terminal states. "delivered" vs "undelivered"/"failed" are mutually
  // exclusive outcomes from Twilio, so equal rank is safe.
  delivered: 5,
  undelivered: 5,
  failed: 5,
  canceled: 5,
};

export function rankMessageStatus(status: string | null | undefined): number {
  const normalized = (status ?? "").trim().toLowerCase();
  return STATUS_RANK[normalized] ?? 0;
}

// Apply a callback status only when it does not move the message backwards.
// Unknown current statuses (null/empty/unrecognized) are always overwritten.
export function shouldApplyMessageStatusTransition(
  currentStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  const next = (nextStatus ?? "").trim().toLowerCase();
  if (!next) return false;
  return rankMessageStatus(next) >= rankMessageStatus(currentStatus);
}
