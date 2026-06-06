// Server-only module: imports the service-role DB layer and committed config.
// It must only be imported from server components and route handlers (never a
// client component) — the client uses the plain types in ./types instead.
import { findClinicById } from "../db/clinics";
import {
  getSmsReadinessState,
  isReadinessFresh,
  listActiveSmsNumbersForClinic,
  type NumberSmsReadiness,
} from "../db/sms-readiness";
import { getA2pSubmissionState } from "../db/a2p-submissions";
import { getA2pSubmissionMode, getAppDomainsSafe, isRealA2pSubmissionEnabled } from "../env";
import { runtimeConfig } from "../../config/runtime.config";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "../validation/url";
import type {
  A2pReviewMissingField,
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "./types";

// Server-side builder for the platform-admin A2P/10DLC review package.
//
// It reads only current DB + committed config state. It performs NO Twilio call,
// NO A2P submission, and never sends SMS. It is the single source of truth used
// by BOTH the admin page (to render) and the submission endpoint (to re-validate
// server-side), so the two can never disagree.
//
// Safety posture: missing/unknown/stale/errored readiness is ALWAYS surfaced as
// "not approved / not covered yet". A number is only ever marked covered when the
// readiness data confirms verified service + campaign + per-number coverage that
// is fresh and free of sync errors.

const MESSAGING_SERVICE_SID = (runtimeConfig.twilio.messagingServiceSid ?? "").trim() || null;

export async function buildA2pReviewPackage(clinicId: string): Promise<A2pReviewPackage> {
  const submissionMode = getA2pSubmissionMode();
  const realSubmissionEnabled = isRealA2pSubmissionEnabled();
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? null;

  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) {
    return notFoundPackage(clinicId, submissionMode, realSubmissionEnabled);
  }

  const [activeNumbers, readinessState, submissionState] = await Promise.all([
    listActiveSmsNumbersForClinic(clinicId).catch(() => []),
    getSmsReadinessState(clinicId),
    getA2pSubmissionState(clinicId),
  ]);

  const readinessAvailable = readinessState.available;
  const readinessByPhoneId = new Map<string, NumberSmsReadiness>();
  for (const n of readinessState.summary?.numbers ?? []) {
    readinessByPhoneId.set(n.clinicPhoneNumberId, n);
  }

  const numbers: A2pReviewNumber[] = activeNumbers.map((active) =>
    buildNumber(active, readinessByPhoneId.get(active.id) ?? null, readinessAvailable),
  );

  // ---- business identity (EIN never exposed in full) ----
  const einDigits = (clinic.ein_tax_id ?? "").replace(/\D/g, "");
  const businessTypeLabel = isBusinessType(clinic.business_type)
    ? BUSINESS_TYPE_LABELS[clinic.business_type]
    : null;

  const business = {
    legalBusinessName: emptyToNull(clinic.legal_business_name),
    businessType: emptyToNull(clinic.business_type),
    businessTypeLabel,
    einProvided: einDigits.length > 0,
    einLast4: einDigits.length >= 4 ? einDigits.slice(-4) : null,
    addressLine: composeAddress(clinic),
    website: emptyToNull(clinic.website),
    mainPhone: emptyToNull(clinic.main_phone),
  };

  const representative = {
    firstName: emptyToNull(clinic.a2p_rep_first_name),
    lastName: emptyToNull(clinic.a2p_rep_last_name),
    title: emptyToNull(clinic.a2p_rep_business_title),
    email: emptyToNull(clinic.a2p_rep_email),
    phone: emptyToNull(clinic.a2p_rep_phone),
    authorized: Boolean(clinic.a2p_authorized),
  };

  const businessPage = clinic.slug && appBaseUrl ? `${appBaseUrl}/business/${clinic.slug}` : null;
  const urls = {
    businessPage,
    privacyPolicy: businessPage ? `${businessPage}/privacy` : null,
    smsTerms: businessPage ? `${businessPage}/sms-terms` : null,
  };

  // ---- required-field validation ----
  const missingFields: A2pReviewMissingField[] = [];
  const req = (cond: boolean, key: string, label: string) => {
    if (!cond) missingFields.push({ key, label });
  };
  req(Boolean(business.legalBusinessName), "legal_business_name", "Legal business name");
  req(business.einProvided, "ein_tax_id", "EIN / Tax ID");
  req(Boolean(business.businessType), "business_type", "Business type");
  req(Boolean(representative.firstName), "rep_first_name", "Representative first name");
  req(Boolean(representative.lastName), "rep_last_name", "Representative last name");
  req(Boolean(representative.email), "rep_email", "Representative email");
  req(Boolean(representative.phone), "rep_phone", "Representative phone");
  req(representative.authorized, "authorized", "Authorization to submit");
  req(
    Boolean(clinic.street_address && clinic.city && clinic.state_region && clinic.postal_code),
    "business_address",
    "Complete business address",
  );
  req(activeNumbers.length > 0, "active_number", "At least one active SMS number");
  req(Boolean(MESSAGING_SERVICE_SID), "messaging_service_sid", "Messaging Service SID");

  // ---- warnings (non-blocking, informational) ----
  const warnings: string[] = [];
  if (!business.website) {
    warnings.push("No business website on file. Carriers usually expect an online presence for A2P review.");
  }
  if (!clinic.a2p_info_completed) {
    warnings.push("The clinic has not yet marked its SMS approval information complete.");
  }
  if (!readinessAvailable) {
    warnings.push(
      "SMS readiness data is unavailable. Apply the readiness migration and run a read-only readiness sync before submitting.",
    );
  } else if (numbers.some((n) => !n.approvedOrCovered)) {
    warnings.push(
      "One or more numbers are not yet covered by the Messaging Service or the A2P campaign. They will show as “Not covered yet” until provider approval and sender coverage are verified.",
    );
  }
  if (submissionMode === "disabled") {
    warnings.push("A2P submission mode is disabled in this environment.");
  }

  // ---- submission record (local state) ----
  const record = submissionState.record;
  const submission = {
    trackingAvailable: submissionState.available,
    status: record?.status ?? null,
    mode: record?.submissionMode ?? null,
    submittedAt: record?.submittedAt ?? null,
    submittedByEmail: record?.submittedByAdminEmail ?? null,
    lastStatusSyncedAt: record?.lastStatusSyncedAt ?? null,
    lastErrorCode: record?.lastErrorCode ?? null,
    lastErrorMessage: record?.lastErrorMessage ?? null,
    rejectionReason: record?.rejectionReason ?? null,
    brandRegistrationSid: record?.twilioBrandRegistrationSid ?? null,
    campaignSid: record?.twilioCampaignSid ?? null,
    messagingServiceSid: record?.twilioMessagingServiceSid ?? null,
  };

  const clinicReadiness = readinessState.summary?.clinic
    ? {
        messagingServiceStatus: readinessState.summary.clinic.messagingServiceStatus,
        brandStatus: readinessState.summary.clinic.brandStatus,
        campaignStatus: readinessState.summary.clinic.campaignStatus,
        a2pStatus: readinessState.summary.clinic.a2pStatus,
        lastSyncedAt: readinessState.summary.clinic.lastSyncedAt,
        blockingReason: readinessState.summary.clinic.launchBlockingReason,
      }
    : null;

  // ---- submit eligibility (for the DRY-RUN review action) ----
  // Coverage-not-yet is intentionally NOT a blocker here: submitting for A2P
  // review is precisely how coverage is later obtained. Unavailable readiness
  // tables, missing required info, and terminal/in-flight states DO block.
  const { submitEligible, submitBlockedReason } = evaluateSubmitEligibility({
    submissionMode,
    readinessAvailable,
    missingCount: missingFields.length,
    activeCount: activeNumbers.length,
    hasMessagingService: Boolean(MESSAGING_SERVICE_SID),
    recordStatus: record?.status ?? null,
  });

  const reviewStatus = deriveReviewStatus({
    recordStatus: record?.status ?? null,
    readinessAvailable,
    missingCount: missingFields.length,
    submissionMode,
  });

  return {
    clinicId,
    clinicName: clinic.name,
    found: true,
    business,
    representative,
    urls,
    messagingServiceSid: MESSAGING_SERVICE_SID,
    readinessAvailable,
    clinicReadiness,
    numbers,
    missingFields,
    warnings,
    submission,
    submissionMode,
    realSubmissionEnabled,
    reviewStatus,
    submitEligible,
    submitBlockedReason,
  };
}

function buildNumber(
  active: { id: string; phone_number: string; twilio_phone_number_sid: string | null },
  readiness: NumberSmsReadiness | null,
  readinessAvailable: boolean,
): A2pReviewNumber {
  const base = {
    phoneNumber: active.phone_number,
    twilioPhoneNumberSid: active.twilio_phone_number_sid,
    billingClass: null,
  };

  if (!readinessAvailable) {
    return {
      ...base,
      messagingServiceSenderStatus: "unknown",
      a2pCampaignCoverageStatus: "unknown",
      coverageDisplay: "readiness_unavailable",
      approvedOrCovered: false,
      eligibleForLiveSms: false,
      blockingReason: "SMS readiness data unavailable",
      lastSyncedAt: null,
    };
  }

  if (!readiness) {
    return {
      ...base,
      messagingServiceSenderStatus: "unknown",
      a2pCampaignCoverageStatus: "unknown",
      coverageDisplay: "readiness_missing",
      approvedOrCovered: false,
      eligibleForLiveSms: false,
      blockingReason: "No readiness data for this number. Run a read-only readiness sync.",
      lastSyncedAt: null,
    };
  }

  const msSender = readiness.messagingServiceSenderStatus;
  const campaign = readiness.a2pCampaignCoverageStatus;
  const fresh = isReadinessFresh(readiness.lastSyncedAt);

  let coverageDisplay: NumberCoverageDisplay;
  let approvedOrCovered = false;
  let blockingReason: string | null = readiness.launchBlockingReason;

  if (readiness.lastSyncErrorCode) {
    coverageDisplay = "error";
    blockingReason = readiness.lastSyncErrorCode;
  } else if (!fresh) {
    coverageDisplay = "stale";
    blockingReason = "Readiness data is stale. Re-run the readiness sync.";
  } else if (msSender !== "covered") {
    coverageDisplay = "not_in_messaging_service";
    blockingReason = readiness.launchBlockingReason ?? "number_not_in_messaging_service";
  } else if (campaign !== "covered") {
    coverageDisplay = "not_campaign_covered";
    blockingReason = readiness.launchBlockingReason ?? "number_not_campaign_covered";
  } else if (readiness.productionSafe) {
    coverageDisplay = "covered";
    approvedOrCovered = true;
    blockingReason = null;
  } else {
    coverageDisplay = "blocked";
    blockingReason = readiness.launchBlockingReason ?? "number_not_production_safe";
  }

  return {
    ...base,
    messagingServiceSenderStatus: msSender,
    a2pCampaignCoverageStatus: campaign,
    coverageDisplay,
    approvedOrCovered,
    eligibleForLiveSms: approvedOrCovered,
    blockingReason,
    lastSyncedAt: readiness.lastSyncedAt,
  };
}

function evaluateSubmitEligibility(input: {
  submissionMode: string;
  readinessAvailable: boolean;
  missingCount: number;
  activeCount: number;
  hasMessagingService: boolean;
  recordStatus: string | null;
}): { submitEligible: boolean; submitBlockedReason: string | null } {
  if (input.submissionMode === "disabled") {
    return { submitEligible: false, submitBlockedReason: "A2P submission is disabled in this environment." };
  }
  if (input.submissionMode === "live") {
    // Real submission is never enabled in this build; the endpoint refuses it.
    return {
      submitEligible: false,
      submitBlockedReason: "Real Twilio A2P submission is not enabled in this build.",
    };
  }
  if (!input.readinessAvailable) {
    return {
      submitEligible: false,
      submitBlockedReason: "SMS readiness data is unavailable. Apply the readiness migration and run a sync first.",
    };
  }
  if (input.missingCount > 0) {
    return { submitEligible: false, submitBlockedReason: "Required information is missing." };
  }
  if (input.activeCount === 0) {
    return { submitEligible: false, submitBlockedReason: "No active SMS number to submit." };
  }
  if (!input.hasMessagingService) {
    return { submitEligible: false, submitBlockedReason: "No Messaging Service SID is configured." };
  }
  if (input.recordStatus && ["submitted", "pending", "approved"].includes(input.recordStatus)) {
    return {
      submitEligible: false,
      submitBlockedReason: "This clinic has already been submitted, is pending, or is approved.",
    };
  }
  if (input.recordStatus === "rejected") {
    return {
      submitEligible: false,
      submitBlockedReason: "A previous submission was rejected. Operator review is required before resubmitting.",
    };
  }
  return { submitEligible: true, submitBlockedReason: null };
}

function deriveReviewStatus(input: {
  recordStatus: string | null;
  readinessAvailable: boolean;
  missingCount: number;
  submissionMode: string;
}): string {
  if (input.recordStatus) return input.recordStatus;
  if (!input.readinessAvailable) return "readiness_unavailable";
  if (input.missingCount > 0) return "missing_info";
  if (input.submissionMode === "disabled") return "submit_disabled";
  return "ready_for_review";
}

function notFoundPackage(
  clinicId: string,
  submissionMode: ReturnType<typeof getA2pSubmissionMode>,
  realSubmissionEnabled: boolean,
): A2pReviewPackage {
  return {
    clinicId,
    clinicName: "",
    found: false,
    business: {
      legalBusinessName: null,
      businessType: null,
      businessTypeLabel: null,
      einProvided: false,
      einLast4: null,
      addressLine: null,
      website: null,
      mainPhone: null,
    },
    representative: {
      firstName: null,
      lastName: null,
      title: null,
      email: null,
      phone: null,
      authorized: false,
    },
    urls: { businessPage: null, privacyPolicy: null, smsTerms: null },
    messagingServiceSid: MESSAGING_SERVICE_SID,
    readinessAvailable: false,
    clinicReadiness: null,
    numbers: [],
    missingFields: [],
    warnings: [],
    submission: {
      trackingAvailable: false,
      status: null,
      mode: null,
      submittedAt: null,
      submittedByEmail: null,
      lastStatusSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      rejectionReason: null,
      brandRegistrationSid: null,
      campaignSid: null,
      messagingServiceSid: null,
    },
    submissionMode,
    realSubmissionEnabled,
    reviewStatus: "not_found",
    submitEligible: false,
    submitBlockedReason: "Clinic not found.",
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}

function isBusinessType(value: string | null): value is BusinessType {
  return value != null && value in BUSINESS_TYPE_LABELS;
}

function composeAddress(clinic: {
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
}): string | null {
  const line1 = [clinic.street_address, clinic.address_line2].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
  const cityState = [clinic.city, clinic.state_region].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
  const line2 = [cityState, (clinic.postal_code ?? "").trim()].filter(Boolean).join(" ");
  const composed = [line1, line2].filter((s) => s.trim().length > 0).join(" · ");
  return composed.length > 0 ? composed : null;
}
