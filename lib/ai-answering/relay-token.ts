// Signed relay token — shared by the Next app (which SIGNS it into the
// ConversationRelay TwiML) and the standalone relay service (which VERIFIES it
// on the WebSocket `setup` message). Keeping both sides in one module means the
// signing scheme can never drift between the two deployables.
//
// The token authenticates the call context that Twilio echoes back to the relay
// as ConversationRelay <Parameter> values. It carries ONLY safe routing facts
// (clinic id, call sid, the two phone numbers, and an issued-at timestamp) plus
// an HMAC-SHA256 signature. It contains NO secret, NO transcript, NO medical or
// PCI data. The signing secret never appears in the token itself.

import { createHmac, timingSafeEqual } from "node:crypto";

export type RelayTokenPayload = {
  clinicId: string;
  callSid: string;
  from: string;
  to: string;
  // Issued-at time, milliseconds since the epoch.
  ts: number;
};

// Bump if the payload shape or signing scheme changes.
const TOKEN_VERSION = "v1";

// Default acceptance window: a call rings, is answered, and the relay WebSocket
// connects within a short window of the TwiML being issued. Ten minutes is
// generous while still bounding replay of a leaked token.
export const DEFAULT_RELAY_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;

export type RelayTokenVerifyReason =
  | "malformed_token"
  | "bad_version"
  | "bad_signature"
  | "malformed_payload"
  | "expired"
  | "not_yet_valid";

export type RelayTokenVerifyResult =
  | { ok: true; payload: RelayTokenPayload }
  | { ok: false; reason: RelayTokenVerifyReason };

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signingInput(version: string, payloadB64: string): string {
  return `${version}.${payloadB64}`;
}

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

// Produce a compact `version.payload.signature` token. Never throws for normal
// input; the caller is responsible for providing a non-empty secret.
export function signRelayToken(payload: RelayTokenPayload, secret: string): string {
  if (!secret) throw new Error("relay token signing secret is required");
  const json = JSON.stringify({
    clinicId: payload.clinicId,
    callSid: payload.callSid,
    from: payload.from,
    to: payload.to,
    ts: payload.ts,
  });
  const payloadB64 = base64url(json);
  const sig = base64url(hmac(secret, signingInput(TOKEN_VERSION, payloadB64)));
  return `${TOKEN_VERSION}.${payloadB64}.${sig}`;
}

function isValidPayload(value: unknown): value is RelayTokenPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.clinicId === "string" &&
    typeof v.callSid === "string" &&
    typeof v.from === "string" &&
    typeof v.to === "string" &&
    typeof v.ts === "number" &&
    Number.isFinite(v.ts)
  );
}

// Verify signature + freshness. Fails closed (returns a stable reason code) for
// any malformed/expired/forged token. Uses a timing-safe signature comparison.
export function verifyRelayToken(
  token: string,
  secret: string,
  opts?: { maxAgeMs?: number; now?: number; clockSkewMs?: number },
): RelayTokenVerifyResult {
  if (!token || !secret) return { ok: false, reason: "malformed_token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed_token" };
  const [version, payloadB64, sigB64] = parts;
  if (version !== TOKEN_VERSION) return { ok: false, reason: "bad_version" };

  const expected = hmac(secret, signingInput(version, payloadB64));
  let provided: Buffer;
  try {
    provided = Buffer.from(sigB64, "base64url");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }
  if (!isValidPayload(payload)) return { ok: false, reason: "malformed_payload" };

  const now = opts?.now ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs ?? DEFAULT_RELAY_TOKEN_MAX_AGE_MS;
  const skew = opts?.clockSkewMs ?? 60 * 1000;
  if (payload.ts - now > skew) return { ok: false, reason: "not_yet_valid" };
  if (now - payload.ts > maxAgeMs) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
