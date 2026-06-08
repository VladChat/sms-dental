import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { buildA2pReviewPackage } from "@/lib/a2p/review-package";
import type { A2pReviewPackage } from "@/lib/a2p/types";
import { runMockA2pSubmission, readA2pProviderStatus } from "@/lib/twilio/a2p-submission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const ActionRequest = z.object({ action: z.string(), confirm: z.boolean().optional() });

// Minimal, safe action endpoint. By default this endpoint performs DRY-RUN
// validations and returns what *would* happen. To actually perform provider
// mutations, callers must pass `confirm: true` (server still may refuse).
export async function POST(req: NextRequest, ctx: { params: Promise<{ clinicId: string }> }) {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId } = await ctx.params;
  if (!UUID_RE.test(clinicId)) return jsonError(404, "not_found", "Clinic not found.");

  const body = await req.json().catch(() => ({}));
  const parsed = ActionRequest.safeParse(body);
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid action request.");
  const { action, confirm } = parsed.data;

  const pkg: A2pReviewPackage | null = await buildA2pReviewPackage(clinicId).catch(() => null);
  if (!pkg || !pkg.found) return jsonError(404, "not_found", "Clinic not found.");

  // For safety, do not perform provider mutations unless confirm===true.
  // This endpoint therefore returns a dry-run description by default.
  switch (action) {
    case "mock_create_brand":
      return jsonOk({ ok: true, dryRun: true, message: "Would create a Mock Brand. Pass confirm=true to execute." });
    case "mock_refresh_brand": {
      // Actually read the mock Brand status from Twilio and persist it.
      try {
        const result = await readA2pProviderStatus(clinicId, "mock");
        return jsonOk({ ok: true, dryRun: false, result });
      } catch (err: any) {
        return jsonError(500, "provider_refresh_error", err?.message ?? "Provider refresh error");
      }
    }
    case "mock_create_campaign": {
      // Ensure mock Brand exists and messaging service configured
      const mockSub = pkg.submissions.mock.submission;
      if (!mockSub.brandRegistrationSid) return jsonError(409, "mock_brand_missing", "No mock Brand exists to create a mock Campaign under.");
      const configuredMs = pkg.authorizationState.mockMessagingServiceSid;
      if (!configuredMs) return jsonError(409, "mock_messaging_service_unconfigured", "Mock messaging service is not configured.");
      if (!confirm) {
        return jsonOk({ ok: true, dryRun: true, message: "Would create a Mock Campaign under existing mock Brand. Pass confirm=true to execute." });
      }
      try {
        const result = await runMockA2pSubmission({ clinicId, adminUserId: admin.userId, adminEmail: admin.email });
        return jsonOk({ ok: true, dryRun: false, result });
      } catch (err: any) {
        return jsonError(500, "a2p_provider_error", err?.message ?? "Provider error");
      }
    }
    case "mock_refresh_campaign":
      return jsonOk({ ok: true, dryRun: true, submission: pkg.submissions.mock.submission });
    case "live_refresh_brand":
      return jsonOk({ ok: true, dryRun: true, submission: pkg.submissions.live.submission });
    case "live_refresh_campaign":
      return jsonOk({ ok: true, dryRun: true, submission: pkg.submissions.live.submission });
    default:
      return jsonError(400, "invalid_action", "Unknown action.");
  }
}
