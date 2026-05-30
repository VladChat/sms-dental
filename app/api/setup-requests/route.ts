import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  getAppDomains,
  isOwnerTestSetupLinkFallbackEnabled,
} from "../../../lib/env";
import { jsonBadRequest, jsonError, jsonOk } from "../../../lib/http/responses";
import { insertSetupRequest, setSetupRequestStatus } from "../../../lib/db/setup-requests";
import { buildSetupUrl, issueSetupToken } from "../../../lib/onboarding/tokens";
import {
  SetupEmailDeliveryError,
  sendSetupLinkEmail,
} from "../../../lib/email/setup-link-email";

// POST /api/setup-requests
//
// Public marketing site (apex domain) posts here to create the setup
// request, generate the setup token, persist its hash, and send the setup
// link email. We never include the raw token in any log line.
//
// CORS: the public site origin comes from committed runtime config.
// We respond with an explicit ACAO for that exact origin only.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SetupRequestInputSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  work_email: z.string().trim().email().max(254),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    // Some browser submits will send urlencoded form bodies when the
    // public site falls back to a native form POST. Accept both.
    try {
      const form = await req.formData();
      payload = {
        full_name: form.get("full_name") ?? undefined,
        work_email: form.get("work_email"),
      };
    } catch {
      return withCors(req, jsonBadRequest("Invalid request body"));
    }
  }

  const parsed = SetupRequestInputSchema.safeParse(payload);
  if (!parsed.success) {
    return withCors(
      req,
      jsonBadRequest("Please provide a valid work email."),
    );
  }

  const ownerName =
    typeof parsed.data.full_name === "string" && parsed.data.full_name.trim().length > 0
      ? parsed.data.full_name.trim()
      : "Clinic owner";

  let appBaseUrl: string;
  let publicSiteUrl: string;
  try {
    ({ appBaseUrl, publicSiteUrl } = getAppDomains());
  } catch {
    return withCors(
      req,
      jsonError(500, "config_missing", "App is not fully configured. Please try again later."),
    );
  }

  const { raw, hash, expiresAt } = issueSetupToken();
  const setupUrl = buildSetupUrl(appBaseUrl, raw);

  // Persist first. We must own a request row before attempting to send
  // email so a delivery failure can update email_status without losing
  // the request.
  const created = await insertSetupRequest({
    ownerFullName: ownerName,
    ownerEmail: parsed.data.work_email.toLowerCase(),
    tokenHash: hash,
    expiresAt,
  });

  // Owner-test fallback: when enabled in committed runtime config, return the
  // link in the response so the owner can complete onboarding before real
  // email is configured. Production must not enable this flag.
  if (isOwnerTestSetupLinkFallbackEnabled()) {
    await setSetupRequestStatus(created.id, "email_sent", {
      emailStatus: "owner_test_fallback",
      emailSentAt: new Date(),
    });
    return withCors(
      req,
      jsonOk({
        ok: true,
        confirm_url: `${publicSiteUrl}/confirm.html`,
        // Setup URL is returned ONLY when the owner-test fallback is on.
        setup_url: setupUrl,
      }),
    );
  }

  try {
    await sendSetupLinkEmail({
      to: parsed.data.work_email,
      setupUrl,
    });
    await setSetupRequestStatus(created.id, "email_sent", {
      emailStatus: "sent",
      emailSentAt: new Date(),
    });
  } catch (err) {
    const status = err instanceof SetupEmailDeliveryError ? err.status : 0;
    await setSetupRequestStatus(created.id, "requested", {
      emailStatus: `failed:${status || "unknown"}`,
    });
    return withCors(
      req,
      jsonError(
        502,
        "email_delivery_failed",
        "We could not send the setup email right now. Please try again in a moment or contact support.",
      ),
    );
  }

  return withCors(
    req,
    jsonOk({ ok: true, confirm_url: `${publicSiteUrl}/confirm.html` }),
  );
}

export function OPTIONS(req: NextRequest): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin") ?? "";
  const safe = getAppDomainsAllowedOrigin();
  if (safe && (origin === safe || origin === safe.replace(/^https?:\/\//, "https://www."))) {
    res.headers.set("access-control-allow-origin", origin);
  } else if (safe) {
    // Echo the canonical public site URL when origin is missing or unmatched.
    res.headers.set("access-control-allow-origin", safe);
  }
  res.headers.set("vary", "origin");
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type");
  res.headers.set("access-control-max-age", "86400");
  return res;
}

function getAppDomainsAllowedOrigin(): string | undefined {
  try {
    return getAppDomains().publicSiteUrl;
  } catch {
    return undefined;
  }
}
