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

// Allowed legal business structures for the Business Information card.
export const BUSINESS_TYPES = [
  "LLC",
  "Corporation",
  "Sole proprietor",
  "Partnership",
  "Other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
