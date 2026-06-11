// URL safety rules for the website scan (SSRF guard). Pure and unit-testable.
//
// The scan only ever fetches the clinic's own public website (read from
// clinics.website). These checks reject anything that is not a plain public
// http(s) site: localhost, private/link-local IPs, IP literals, internal
// hostnames, non-default ports, embedded credentials, and non-http schemes.
// Redirect hops and discovered links must re-pass these checks and stay
// same-origin.

export type ScanUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".localdomain",
];

function isIpv4Literal(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isIpv6Literal(hostname: string): boolean {
  // URL hostnames keep IPv6 literals in brackets.
  return hostname.startsWith("[") || hostname.includes(":");
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host === "broadcasthost") return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // Single-label hostnames (no dot) are internal names, never public sites.
  if (!host.includes(".")) return true;
  // Reject ALL IP-literal hosts (public ones included): real clinic websites
  // use domain names, and skipping literals removes the private-range and
  // mapped-address parsing edge cases entirely.
  if (isIpv4Literal(host) || isIpv6Literal(host)) return true;
  return false;
}

// Validate the clinic website (or a redirect target) as a safe scan URL.
// Accepts bare domains by assuming https.
export function validateScanUrl(raw: string): ScanUrlResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "missing_url" };
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, reason: "non_default_port" };
  }
  if (isBlockedHostname(url.hostname)) {
    return { ok: false, reason: "blocked_host" };
  }
  url.hash = "";
  return { ok: true, url };
}

export function isSameOrigin(a: URL, b: URL): boolean {
  return a.origin === b.origin;
}

// Resolve an in-page link against the scanned origin. Returns a normalized
// absolute URL string, or null when the link is unsafe, cross-origin, or not
// an http(s) document link.
export function sanitizeSameOriginLink(href: string, base: URL): string | null {
  const trimmed = (href ?? "").trim();
  if (trimmed.length === 0) return null;
  if (/^(javascript|data|file|mailto|tel|sms|blob|about):/i.test(trimmed)) return null;
  let resolved: URL;
  try {
    resolved = new URL(trimmed, base);
  } catch {
    return null;
  }
  const checked = validateScanUrl(resolved.href);
  if (!checked.ok) return null;
  if (!isSameOrigin(checked.url, base)) return null;
  checked.url.hash = "";
  return checked.url.href;
}
