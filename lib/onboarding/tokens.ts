import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Secure setup token utilities.
//
// Tokens are 32 random bytes hex-encoded (64 characters). The raw token is
// embedded in the emailed setup URL only and never persisted. The database
// stores only the SHA-256 hash. Validation is constant-time.
//
// Token lifetime is fixed at 72 hours, matching the build guide.
//
// Important:
//   - Never log raw tokens or hashes in production code.
//   - Generate setup URLs using the trusted APP_BASE_URL only — never from
//     request Host headers.

const TOKEN_BYTES = 32;
const TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;
export const SETUP_TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000;

export type SetupTokenIssue = {
  /** Raw hex token. Goes into the email URL. Never persisted. */
  raw: string;
  /** SHA-256(raw) hex. Persisted in DB. */
  hash: string;
  /** Absolute expiry timestamp. */
  expiresAt: Date;
};

export function issueSetupToken(now: Date = new Date()): SetupTokenIssue {
  const raw = randomBytes(TOKEN_BYTES).toString("hex");
  const hash = hashSetupToken(raw);
  const expiresAt = new Date(now.getTime() + SETUP_TOKEN_LIFETIME_MS);
  return { raw, hash, expiresAt };
}

export function hashSetupToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Returns true when the candidate raw token hashes to the expected hash.
 * Uses constant-time comparison.
 */
export function tokensMatch(rawCandidate: string, expectedHash: string): boolean {
  if (!isLikelyRawToken(rawCandidate)) return false;
  const candidateHash = hashSetupToken(rawCandidate);
  const a = Buffer.from(candidateHash, "utf8");
  const b = Buffer.from(expectedHash, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Cheap shape check before doing any database lookup. */
export function isLikelyRawToken(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  if (value.length !== TOKEN_HEX_LENGTH) return false;
  return /^[0-9a-f]+$/i.test(value);
}

/** Returns true if the absolute expiry is in the past, relative to `now`. */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Compose the absolute setup URL from a trusted app base URL. */
export function buildSetupUrl(appBaseUrl: string, rawToken: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/setup/${rawToken}`;
}
