import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { buildA2pReviewPackage } from "@/lib/a2p/review-package";
import { upsertA2pSubmission } from "@/lib/db/a2p-submissions";
import { getA2pSubmissionMode } from "@/lib/env";
import type { A2pReviewPackage, JsonObject } from "@/lib/a2p/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// POST /api/admin/clinics/[clinicId]/a2p/submit
//
// Platform-admin-only A2P review submission. Re-builds the review package
// server-side, re-validates required fields, refuses duplicates, and persists a
// LOCAL review/submission status. In the default "dry_run" mode this records a
// "dry_run_reviewed" status meaning the operator reviewed the package and it is
// ready for manual submission in the Twilio console.
//
// It NEVER submits a real A2P/10DLC registration, NEVER mutates Twilio, NEVER
// attaches/detaches Messaging Service senders, NEVER sends SMS, and NEVER
// enables sms_recovery_enabled. "live" mode is refused outright.
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
  if (!UUID_RE.test(clinicId)) {
    return jsonError(404, "not_found", "Clinic not found.");
  }

  const pkg = await buildA2pReviewPackage(clinicId).catch(() => null);
  if (!pkg || !pkg.found) {
    return jsonError(404, "not_found", "Clinic not found.");
  }

  const mode = getA2pSubmissionMode();

  // Mode gate. Default config is "dry_run". Real submission is never performed.
  if (mode === "disabled") {
    return jsonError(409, "submission_disabled", "A2P submission is disabled in this environment.");
  }
  if (mode === "live") {
    return jsonError(
      409,
      "real_submission_disabled",
      "Real Twilio A2P submission is not enabled in this build. No provider changes were made.",
    );
  }

  // --- server-side re-validation (never trust the client) ---
  if (!pkg.readinessAvailable) {
    return jsonError(
      409,
      "readiness_unavailable",
      "SMS readiness data is unavailable. Apply the readiness migration and run a read-only readiness sync before submitting.",
    );
  }
  if (pkg.missingFields.length > 0) {
    return jsonError(422, "missing_info", "Required A2P information is missing.", {
      missing: pkg.missingFields.map((f) => f.key),
    });
  }

  // --- duplicate / terminal-state protection ---
  const currentStatus = pkg.submission.status;
  if (currentStatus && ["submitted", "pending", "approved"].includes(currentStatus)) {
    return jsonError(
      409,
      "already_submitted",
      "This clinic has already been submitted, is pending, or is approved.",
    );
  }
  if (currentStatus === "rejected") {
    return jsonError(
      409,
      "rejected_no_resubmit",
      "A previous submission was rejected. Operator review is required before resubmitting.",
    );
  }
  if (!pkg.submitEligible) {
    return jsonError(409, "not_eligible", pkg.submitBlockedReason ?? "This clinic is not eligible for submission.");
  }

  // --- persist the dry-run reviewed status (no Twilio mutation) ---
  const selectedPhoneNumbers = pkg.numbers.map((n) => ({
    phoneNumber: n.phoneNumber,
    twilioPhoneNumberSid: n.twilioPhoneNumberSid,
  }));

  let record;
  try {
    record = await upsertA2pSubmission({
      clinicId,
      status: "dry_run_reviewed",
      submissionMode: "dry_run",
      targetMessagingServiceSid: pkg.messagingServiceSid,
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
      "A2P submission tracking is unavailable. Apply the additive migration " +
        "20260607000100_a2p_submission_tracking.sql in the target database and try again.",
    );
  }

  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.a2p.submit_dry_run",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: {
        status: record.status,
        mode: "dry_run",
        number_count: selectedPhoneNumbers.length,
        review_status: pkg.reviewStatus,
      },
      metadata: { authSource: admin.source, real_submission: false },
    });
  } catch {
    // Persist already succeeded; never fail the operator on an audit hiccup.
  }

  return jsonOk({
    ok: true,
    status: record.status,
    mode: "dry_run",
    realSubmission: false,
    message:
      "Recorded a dry-run review. The A2P package is marked ready for manual submission in the Twilio console. " +
      "No A2P registration was submitted and no Twilio resources were changed.",
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
    messaging_service_sid: pkg.messagingServiceSid,
    business_page: pkg.urls.businessPage,
    privacy_policy: pkg.urls.privacyPolicy,
    sms_terms: pkg.urls.smsTerms,
    numbers: pkg.numbers.map((n) => ({
      phone_number: n.phoneNumber,
      pn_sid: n.twilioPhoneNumberSid,
      coverage: n.coverageDisplay,
    })),
  };
}
