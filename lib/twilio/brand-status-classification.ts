// Pure status classification helpers for Twilio A2P Brand Registration.
// No DB, env, or Twilio client imports — safe for test compilation.

/**
 * Determine whether a provider status string indicates the Brand is fully
 * approved. Returns true for APPROVED and VERIFIED (the latter may appear on
 * related Twilio resources like Trust Products / Campaigns).
 */
export function isBrandApprovedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "APPROVED" || s === "VERIFIED";
}

/**
 * Determine whether a provider status string indicates the Brand is actively
 * in review / awaiting provider decision (neither terminal nor approved).
 */
export function isBrandPendingStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return (
    s === "PENDING" ||
    s === "IN_REVIEW" ||
    s === "PENDING_REVIEW" ||
    s === "PENDING REVIEW" ||
    s === "IN REVIEW"
  );
}

/**
 * Determine whether a provider status string indicates a terminal /
 * non-recoverable Brand failure. Covers FAILED, REJECTED, DECLINED,
 * SUSPENDED, and UNVERIFIED. If the value is an unexpected string that is
 * neither approved nor pending, it is NOT treated as approved — callers
 * should keep it as a controlled blocker instead.
 */
export function isBrandTerminalFailureStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return (
    s === "FAILED" ||
    s === "REJECTED" ||
    s === "DECLINED" ||
    s === "SUSPENDED" ||
    s === "UNVERIFIED"
  );
}

/**
 * Normalize a raw Twilio Brand status into one of: "approved", "pending",
 * "failed", or "unknown". Never returns an empty string.
 */
export function normalizeBrandStatus(raw: string | null | undefined): "approved" | "pending" | "failed" | "unknown" {
  if (isBrandApprovedStatus(raw)) return "approved";
  if (isBrandPendingStatus(raw)) return "pending";
  if (isBrandTerminalFailureStatus(raw)) return "failed";
  if ((raw ?? "").trim()) return "unknown";
  return "unknown";
}
