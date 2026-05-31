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
// Legacy setup-token fallback for account context (`mcd_account` cookie). This
// remains during the owner-auth rollout so existing setup-link sessions are not
// locked out. Real auth session + clinic membership is now the primary guard
// path for `/account` and `/workspace`.

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
