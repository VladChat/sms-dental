// Safe URL validation for customer-provided website links.
//
// We only accept absolute https:// URLs with a real host. This blocks unsafe
// schemes (javascript:, data:, http:, etc.) so a stored website can be
// rendered as a link on the public business page without XSS risk.

export function isSafeHttpsUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // Require a dotted hostname (e.g. example.com), not bare "https://localhost".
  if (!url.hostname || !url.hostname.includes(".")) return false;
  return true;
}

// Official business-type enum values used for carrier/A2P registration.
// Store and submit these EXACT values — never human-friendly approximations
// or legacy free-text labels.
export const BUSINESS_TYPES = [
  "PRIVATE_PROFIT",
  "PUBLIC_PROFIT",
  "NON_PROFIT",
  "SOLE_PROPRIETOR",
  "GOVERNMENT",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

// Default/preferred value for a normal private dental clinic.
export const DEFAULT_BUSINESS_TYPE: BusinessType = "PRIVATE_PROFIT";

// Human-readable labels shown in the UI. The underlying value submitted and
// stored is always the exact enum value above.
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  PRIVATE_PROFIT: "Private company (for-profit)",
  PUBLIC_PROFIT: "Public company (for-profit)",
  NON_PROFIT: "Non-profit",
  SOLE_PROPRIETOR: "Individual / sole owner",
  GOVERNMENT: "Government",
};
