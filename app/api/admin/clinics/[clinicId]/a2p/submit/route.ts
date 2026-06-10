import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { buildA2pReviewPackage } from "@/lib/a2p/review-package";
import { upsertA2pSubmission, upsertA2pSubmissionProgress } from "@/lib/db/a2p-submissions";
import { getA2pSubmissionMode } from "@/lib/env";
import {
  A2pSubmissionDisabledError,
  A2pSubmissionPersistError,
  runMockA2pSubmission,
  runRealA2pSubmission,
} from "@/lib/twilio/a2p-submission";
import type { A2pReviewPackage, JsonObject } from "@/lib/a2p/types";
import { isLiveCampaignCreationPending } from "@/lib/a2p/submission-modes";
import {
  firstValidationMessage,
  type A2pValidationResult,
  validateA2pPreflight,
} from "@/lib/a2p/validation";
import { textingStatusSyncConfig } from "@/config/texting-status-sync.config";
import { syncPhoneNumberTextingStatusesBestEffort } from "@/lib/texting-status/sync";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const SubmitRequestSchema = z.object({
  submissionMode: z.enum(["dry_run", "mock", "live"]).default("dry_run"),
  intent: z.enum(["submit", "create_live_campaign"]).default("submit"),
  confirmMockSubmit: z.boolean().optional(),
  confirmLiveSubmit: z.boolean().optional(),
  confirmLiveCampaign: z.boolean().optional(),
});

// POST /api/admin/clinics/[clinicId]/a2p/submit
//
// Platform-admin-only A2P review submission. Re-builds and re-validates the
// review package server-side, refuses terminal/ineligible states, then either:
//   - dry_run mode: records a local "dry_run_reviewed" status (no Twilio), or
//   - live mode (armed for this clinic): runs the REAL, idempotent, resumable
//     Twilio A2P submission state machine.
//
// It NEVER sends SMS and NEVER enables sms_recovery_enabled.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId } = await ctx.params;
  if (!UUID_RE.test(clinicId)) return jsonError(404, "not_found", "Clinic not found.");
  const requestId = req.headers.get("x-vercel-id") ?? `a2p-${clinicId}`;
  const body = await req.json().catch(() => ({}));
  const parsedBody = SubmitRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "invalid_request", "Choose a valid A2P submission mode.");
  }
  const submitRequest = parsedBody.data;

  const pkg = await buildA2pReviewPackage(clinicId).catch(() => null);
  if (!pkg || !pkg.found) return jsonError(404, "not_found", "Clinic not found.");

  const environmentMode = getA2pSubmissionMode();
  if (environmentMode === "disabled") {
    return jsonError(409, "submission_disabled", "A2P submission is disabled in this environment.");
  }
  const requestedMode = submitRequest.submissionMode;
  const requestedOption = pkg.authorizationState.modeOptions.find((option) => option.mode === requestedMode);
  if (!requestedOption) {
    return jsonError(400, "invalid_request", "Choose a valid A2P submission mode.");
  }

  logger.info("a2p.submit.started", {
    clinicId,
    step: "request_received",
    submissionMode: requestedMode,
    requestId,
    createdCount: 0,
  });

  // Shared server-side re-validation (never trust the client).
  if (pkg.missingFields.length > 0) {
    return jsonError(422, "missing_info", "Required A2P information is missing.", {
      missing: pkg.missingFields.map((f) => f.key),
    });
  }
  if (!pkg.authorizationState.submitEligible) {
    return jsonError(
      409,
      "not_eligible",
      pkg.authorizationState.submitBlockedReason ?? "This clinic is not eligible for submission.",
    );
  }
  if (!requestedOption.available) {
    return jsonError(
      409,
      "mode_unavailable",
      requestedOption.disabledReason ?? "That submission mode is not available for this clinic.",
    );
  }
  if (requestedMode === "mock" && submitRequest.confirmMockSubmit !== true) {
    return jsonError(
      400,
      "mock_confirmation_required",
      "Confirm that Mock A2P creates mock Twilio resources only and will not enable real SMS sending.",
    );
  }
  if (requestedMode === "live" && submitRequest.intent === "submit" && submitRequest.confirmLiveSubmit !== true) {
    return jsonError(
      400,
      "live_confirmation_required",
      "Confirm that you authorize a real billable Twilio A2P submission before continuing.",
    );
  }
  if (requestedMode === "live" && submitRequest.intent === "create_live_campaign") {
    if (submitRequest.confirmLiveCampaign !== true) {
      return jsonError(
        400,
        "live_campaign_confirmation_required",
        "Confirm that you understand live Campaign creation creates recurring monthly A2P Campaign fees.",
      );
    }
    if (!isLiveCampaignCreationPending(pkg.submissions.live.submission)) {
      return jsonError(
        409,
        "live_campaign_not_ready",
        "The live Brand is not approved for separate Campaign creation yet.",
      );
    }
  }

  // Audit the attempt before any provider call.
  await recordAdminAuditEvent({
    adminUserId: admin.userId,
    adminEmail: admin.email,
    action: "clinic.a2p.submit_attempt",
    targetType: "clinic",
    targetId: clinicId,
    clinicId,
    afterState: {
      mode: requestedMode,
      review_status: pkg.authorizationState.reviewStatus,
      number_count: pkg.includedSenders.numbers.length,
    },
    metadata: { authSource: admin.source },
  }).catch(() => {});

  // ---------------- dry_run mode (no Twilio mutation) ----------------
  if (requestedMode === "dry_run") {
    const selectedPhoneNumbers = pkg.includedSenders.numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      twilioPhoneNumberSid: n.twilioPhoneNumberSid,
    }));
    let record;
    try {
      record = await upsertA2pSubmission({
        clinicId,
        status: "dry_run_reviewed",
        submissionMode: "dry_run",
        targetMessagingServiceSid: pkg.internalDiagnostics.messagingServiceSid,
        selectedPhoneNumbers,
        submittedAt: new Date(),
        submittedByAdminUserId: admin.userId,
        submittedByAdminEmail: admin.email,
        payloadSnapshot: redactedSnapshot(pkg),
      });
    } catch {
      return jsonError(
        503,
        "tracking_unavailable",
        "A2P submission tracking is unavailable. Apply migration 20260611000100_a2p_submission_modes.sql and try again.",
      );
    }
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.a2p.submit_dry_run",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: { status: record.status, mode: "dry_run", number_count: selectedPhoneNumbers.length },
      metadata: { authSource: admin.source, real_submission: false },
    }).catch(() => {});

    return jsonOk({
      ok: true,
      status: record.status,
      mode: "dry_run",
      realSubmission: false,
      message:
        "Recorded a dry-run review. The A2P package is marked ready for manual submission. " +
        "No A2P registration was submitted and no Twilio resources were changed.",
    });
  }

  // ---------------- provider mutation modes (mock/live) ----------------
  const validationErrors = validateA2pPreflight(pkg).filter((result) => result.severity === "error");
  if (validationErrors.length > 0) {
    const safeMessage =
      firstValidationMessage(validationErrors) ??
      "Cannot submit: required A2P fields are invalid. Correct them before A2P submission.";
    logger.warn("a2p.submit.preflight_failed", {
      clinicId,
      step: "preflight_validation",
      submissionMode: requestedMode,
      requestId,
      safeErrorMessage: safeMessage,
      validationErrorCodes: validationErrors.map((result) => result.code),
      createdCount: 0,
    });
    try {
      await upsertA2pSubmissionProgress({
        clinicId,
        submissionMode: requestedMode,
        status: "blocked",
        submissionStep: "preflight_validation",
        submittedByAdminUserId: admin.userId,
        submittedByAdminEmail: admin.email,
        lastErrorCode: "A2P_PREFLIGHT_VALIDATION_FAILED",
        lastErrorMessage: safeMessage,
      });
    } catch (err) {
      logger.error("a2p.submit.persist_failed", {
        clinicId,
        step: "preflight_validation",
        submissionMode: requestedMode,
        requestId,
        safeErrorMessage: err instanceof Error ? err.message.slice(0, 300) : "persist_failed",
        createdCount: 0,
        requires_recovery: false,
      });
      return jsonError(
        503,
        "tracking_unavailable",
        "A2P submission tracking is unavailable. Fix tracking before retrying A2P submission.",
      );
    }
    return jsonOk({
      ok: false,
      status: "blocked",
      step: "preflight_validation",
      error: {
        code: "A2P_PREFLIGHT_VALIDATION_FAILED",
        message: safeMessage,
      },
      validationErrors: validationErrors.map(toUiValidationError),
    });
  }

  if (!pkg.authorizationState.liveSubmitArmed) {
    if (requestedMode === "live") {
      return jsonError(
        409,
        "not_armed",
        pkg.authorizationState.liveSubmitBlockedReason ?? "Real A2P submission is not armed for this clinic.",
      );
    }
  }

  let result;
  const providerAction = requestedMode === "mock"
    ? "clinic.a2p.submit_mock"
    : submitRequest.intent === "create_live_campaign"
      ? "clinic.a2p.create_live_campaign"
      : "clinic.a2p.submit_live";
  try {
    result = requestedMode === "mock"
      ? await runMockA2pSubmission({
        clinicId,
        adminUserId: admin.userId,
        adminEmail: admin.email,
      })
      : await runRealA2pSubmission({
        clinicId,
        adminUserId: admin.userId,
        adminEmail: admin.email,
        allowCampaignCreate: submitRequest.intent === "create_live_campaign",
      });
  } catch (err) {
    if (err instanceof A2pSubmissionDisabledError) {
      return jsonError(409, "submission_disabled", err.message);
    }
    if (err instanceof A2pSubmissionPersistError) {
      return jsonError(
        503,
        "tracking_failed_after_provider_mutation",
        err.message,
      );
    }
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.a2p.submit_failed",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: { mode: requestedMode },
      metadata: { authSource: admin.source, real_submission: requestedMode === "live", mock_submission: requestedMode === "mock" },
    }).catch(() => {});
    return jsonError(
      502,
      "provider_error",
      "The A2P submission could not be completed against the provider. Created resources are reused on retry.",
    );
  }

  await recordAdminAuditEvent({
    adminUserId: admin.userId,
    adminEmail: admin.email,
    action: result.ok ? providerAction : "clinic.a2p.submit_failed",
    targetType: "clinic",
    targetId: clinicId,
    clinicId,
    afterState: {
      mode: requestedMode,
      status: result.status,
      step: result.step,
      created_count: result.createdResources.length,
    },
    metadata: {
      authSource: admin.source,
      real_submission: requestedMode === "live",
      mock_submission: requestedMode === "mock",
    },
  }).catch(() => {});

  logger.info(result.ok ? "a2p.submit.completed" : "a2p.submit.step_failed", {
    clinicId,
    step: result.step,
    submissionMode: requestedMode,
    requestId,
    safeErrorMessage: result.providerErrors[0] ?? null,
    createdCount: result.createdResources.length,
  });

  if (result.ok && requestedMode === "live") {
    await syncPhoneNumberTextingStatusesBestEffort({
      clinicId,
      force: true,
      limit: textingStatusSyncConfig.singleClinicBatchSize,
      event: "admin_live_a2p_submit_success",
    });
  }

  return jsonOk({
    ok: result.ok,
    status: result.status,
    mode: requestedMode,
    realSubmission: requestedMode === "live",
    mockSubmission: requestedMode === "mock",
    step: result.step,
    message: result.message,
    error: result.ok
      ? undefined
      : { code: "A2P_PROVIDER_ERROR", message: result.providerErrors[0] ?? result.message },
    createdResources: result.createdResources,
    providerErrors: result.providerErrors,
    nextAction: result.nextAction,
  });
}

// Redacted, non-secret snapshot of the reviewed package. The full EIN/tax id is
// never stored — only presence + last 4. No secrets, tokens, or patient data.
function redactedSnapshot(pkg: A2pReviewPackage): JsonObject {
  return {
    clinic_name: pkg.clinicName,
    legal_business_name: pkg.business.legalBusinessName,
    business_type: pkg.business.businessType,
    ein_provided: pkg.business.einProvided,
    ein_last4: pkg.business.einLast4,
    website: pkg.business.website,
    rep_first_name: pkg.representative.firstName,
    rep_last_name: pkg.representative.lastName,
    rep_title: pkg.representative.title,
    rep_email: pkg.representative.email,
    rep_phone: pkg.representative.phone,
    authorized: pkg.representative.authorized,
    messaging_service_sid: pkg.internalDiagnostics.messagingServiceSid,
    business_page: pkg.urls.businessPage,
    privacy_policy: pkg.urls.privacyPolicy,
    sms_terms: pkg.urls.smsTerms,
    campaign_usecase: pkg.campaign.usecase,
    numbers: pkg.internalDiagnostics.numberDiagnostics.map((n) => ({
      phone_number: n.phoneNumber,
      pn_sid: n.twilioPhoneNumberSid,
      coverage: n.coverageDisplay,
    })),
  };
}

function toUiValidationError(result: A2pValidationResult) {
  return {
    field: result.field,
    code: result.code,
    message: result.message,
  };
}
