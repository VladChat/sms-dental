// Best-effort X-Twilio-Signature validation for the WebSocket upgrade request.
//
// Twilio signs requests as base64(HMAC-SHA1(authToken, fullUrl + sortedParams)).
// The ConversationRelay upgrade is a GET with no POST params, so only the URL is
// signed. Reconstructing the exact public URL behind a proxy is unreliable, so
// this is treated as a SECONDARY check — the signed token in the setup message
// (verifyRelayToken) is the authoritative gate. By default a mismatch only warns;
// set AI_ANSWERING_RELAY_ENFORCE_TWILIO_SIGNATURE=true to hard-reject.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

function header(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

// Rebuild the URL Twilio most likely signed from forwarding headers.
export function reconstructUpgradeUrl(req: IncomingMessage): string | null {
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  if (!host || !req.url) return null;
  const proto = header(req, "x-forwarded-proto") ?? "https";
  return `${proto}://${host}${req.url}`;
}

export type TwilioSignatureCheck = "valid" | "invalid" | "skipped";

export function checkTwilioUpgradeSignature(
  req: IncomingMessage,
  authToken: string | null,
): TwilioSignatureCheck {
  if (!authToken) return "skipped";
  const provided = header(req, "x-twilio-signature");
  if (!provided) return "skipped";
  const url = reconstructUpgradeUrl(req);
  if (!url) return "skipped";

  const expected = createHmac("sha1", authToken).update(url).digest("base64");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "valid" : "invalid";
}
