import type { NextRequest } from "next/server";
import { getPublicWebhookBaseUrl } from "../env";

// Parse an application/x-www-form-urlencoded body into a plain string map.
// Twilio webhooks always send form-encoded payloads.
export async function readTwilioFormPayload(
  request: Request,
): Promise<Record<string, string>> {
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

// Reconstruct the public webhook URL Twilio used to sign the request.
//
// Preference order:
//   1. PUBLIC_WEBHOOK_BASE_URL + pathname + search (most reliable; the URL
//      Twilio actually called must match exactly).
//   2. request.url (used in dev / when no override is set).
//
// We intentionally never trust X-Forwarded-* headers blindly — they can be
// spoofed by a non-Vercel ingress and would let an attacker mint a signature
// for a different host.
export function reconstructTwilioWebhookUrl(request: NextRequest | Request): string {
  const requestUrl = new URL(request.url);
  const base = getPublicWebhookBaseUrl();
  if (!base) return requestUrl.toString();
  const baseUrl = new URL(base);
  return new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    baseUrl,
  ).toString();
}
