import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../lib/onboarding/verify";
import { setAccountSessionCookie } from "../../../../lib/onboarding/account-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/session
//
// Establishes account context for the clean `/account` dashboard URL. Takes a
// valid raw setup token (in the JSON body, never a URL/query) and stores it in
// an httpOnly session cookie. Used when a returning customer re-opens an email
// setup link whose clinic already exists, so they land on `/account` instead of
// the long token URL. The token is validated before the cookie is set and is
// never logged.

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : "";

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) {
    return jsonError(404, "invalid_setup_link", "This setup link is invalid or expired.");
  }

  await setAccountSessionCookie(token);
  return jsonOk({ ok: true });
}
