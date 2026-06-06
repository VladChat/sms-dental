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
import {
  getA2pBrandConfig,
  getA2pSubmissionMode,
  getA2pTrustHubConfig,
  getAppDomainsSafe,
  isClinicAllowedForLiveA2pSubmit,
  isRealA2pSubmissionEnabled,
} from "../env";
import { runtimeConfig } from "../../config/runtime.config";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "../validation/url";
import { buildCampaignContent } from "./campaign-content";
import { addressParams, buildProviderPayloadView, mapBusinessType } from "./provider-payload";
import type {
  A2pPlannedResource,
  A2pReviewMissingField,
  A2pReviewNumber,
  A2pReviewPackage,
  JsonObject,
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
  req(Boolean(urls.businessPage), "website", "Public business page URL (clinic must have a slug and app base URL configured)");
  req(activeNumbers.length > 0, "active_number", "At least one active SMS number");
  req(Boolean(MESSAGING_SERVICE_SID), "messaging_service_sid", "Messaging Service SID");

  // ---- warnings (non-blocking, informational) ----
  const warnings: string[] = [];
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
  const ps = (record?.providerState ?? {}) as JsonObject;
  const psStr = (key: string): string | null => {
    const v = ps[key];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const submission = {
    trackingAvailable: submissionState.available,
    status: record?.status ?? null,
    mode: record?.submissionMode ?? null,
    submissionStep: record?.submissionStep ?? null,
    submittedAt: record?.submittedAt ?? null,
    submittedByEmail: record?.submittedByAdminEmail ?? null,
    lastStatusSyncedAt: record?.lastStatusSyncedAt ?? null,
    lastErrorCode: record?.lastErrorCode ?? null,
    lastErrorMessage: record?.lastErrorMessage ?? null,
    rejectionReason: record?.rejectionReason ?? null,
    customerProfileSid:
      record?.twilioSecondaryCustomerProfileSid ?? record?.twilioCustomerProfileSid ?? null,
    trustProductSid: record?.twilioTrustProductSid ?? null,
    brandRegistrationSid: record?.twilioBrandRegistrationSid ?? null,
    campaignSid: record?.twilioCampaignSid ?? null,
    messagingServiceSid: record?.twilioMessagingServiceSid ?? null,
    customerProfileStatus: psStr("customerProfileStatus"),
    trustProductStatus: psStr("trustProductStatus"),
    brandStatus: psStr("brandStatus"),
    campaignStatus: psStr("campaignStatus"),
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

  // ---- live-submit arming (real provider mutation) ----
  const trustHub = getA2pTrustHubConfig();
  const { liveSubmitArmed, liveSubmitBlockedReason } = evaluateLiveArming({
    clinicId,
    submissionMode,
    hasPrimaryProfile: Boolean(trustHub.primaryCustomerProfileSid),
  });

  const campaign = buildCampaignContent(clinic.name);

  // ---- minimal provider payload view (exactly what is submitted to Twilio) ----
  // Built from the SAME shared builders the submission helper uses, with the EIN
  // masked. Optional/internal fields (privacy/SMS-terms/business-page URLs,
  // readiness, SIDs, statuses) are intentionally NOT in this payload.
  const brandCfg = getA2pBrandConfig();
  const providerPayload = buildProviderPayloadView({
    clinicName: clinic.name,
    legalBusinessName: business.legalBusinessName ?? clinic.name,
    businessTypeMapped: mapBusinessType(clinic.business_type, brandCfg.businessTypeFallback),
    industry: brandCfg.businessIndustry,
    registrationIdentifier: brandCfg.businessRegistrationIdentifier,
    einMaskedValue: business.einProvided ? `Provided ···· ${business.einLast4 ?? "••••"}` : "(missing)",
    regionsOfOperation: brandCfg.regionsOfOperation,
    identity: brandCfg.businessIdentity,
    websiteUrl: urls.businessPage ?? "(missing)",
    repFirstName: representative.firstName ?? "(missing)",
    repLastName: representative.lastName ?? "(missing)",
    repEmail: representative.email ?? "(missing)",
    repPhone: representative.phone ?? "(missing)",
    repJobPosition: representative.title ?? "Owner",
    repBusinessTitle: representative.title ?? "Owner",
    companyType: brandCfg.companyType,
    address: addressParams({
      customerName: business.legalBusinessName ?? clinic.name,
      street: clinic.street_address ?? "(missing)",
      addressLine2: clinic.address_line2,
      city: clinic.city ?? "(missing)",
      region: clinic.state_region ?? "(missing)",
      postalCode: clinic.postal_code ?? "(missing)",
      isoCountry: clinic.country ?? "US",
    }),
    customerProfilePolicySid: trustHub.customerProfilePolicySid,
    a2pTrustProductPolicySid: trustHub.a2pTrustProductPolicySid,
    brandType: brandCfg.brandType,
    campaign,
    numbers: activeNumbers.map((n) => ({ phoneNumber: n.phone_number, twilioPhoneNumberSid: n.twilio_phone_number_sid })),
  });

  const plannedResources: A2pPlannedResource[] = [
    planned("Secondary Customer Profile", record?.twilioSecondaryCustomerProfileSid ?? record?.twilioCustomerProfileSid ?? null),
    planned("A2P Trust Product", record?.twilioTrustProductSid ?? null),
    planned("Brand Registration", record?.twilioBrandRegistrationSid ?? null),
    planned(`A2P Campaign (${campaign.usecase})`, record?.twilioCampaignSid ?? null),
    planned("Messaging Service senders (per active number)", null, true),
  ];

  const feesRiskNotice = [
    "Brand Registration incurs a one-time Twilio/TCR fee.",
    "A2P Campaign registration incurs recurring monthly carrier fees.",
    "Submissions enter external carrier vetting and cannot simply be undone.",
    "Incorrect business identity (EIN, legal name, address) can cause rejection and re-vetting fees/delays.",
  ];

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
    liveSubmitArmed,
    liveSubmitBlockedReason,
    campaign,
    providerPayload,
    plannedResources,
    feesRiskNotice,
    reviewStatus,
    submitEligible,
    submitBlockedReason,
  };
}

function planned(label: string, reuseSid: string | null, alwaysCreate = false): A2pPlannedResource {
  return {
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    label,
    willCreate: alwaysCreate ? true : reuseSid === null,
    reuseSid,
  };
}

function evaluateLiveArming(input: {
  clinicId: string;
  submissionMode: string;
  hasPrimaryProfile: boolean;
}): { liveSubmitArmed: boolean; liveSubmitBlockedReason: string | null } {
  if (input.submissionMode !== "live") {
    return { liveSubmitArmed: false, liveSubmitBlockedReason: "Real submission mode is not enabled (mode is not “live”)." };
  }
  if (!isClinicAllowedForLiveA2pSubmit(input.clinicId)) {
    return { liveSubmitArmed: false, liveSubmitBlockedReason: "This clinic is not on the live A2P submission allowlist." };
  }
  if (!input.hasPrimaryProfile) {
    return { liveSubmitArmed: false, liveSubmitBlockedReason: "No primary Customer Profile SID is configured for real submission." };
  }
  return { liveSubmitArmed: true, liveSubmitBlockedReason: null };
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
  // Terminal states block submit. "submitted"/"pending"/"failed" stay eligible so
  // the idempotent live state machine can RESUME (e.g. after async brand approval)
  // without creating duplicate resources; dry_run simply re-records its review.
  if (input.recordStatus === "approved") {
    return { submitEligible: false, submitBlockedReason: "This clinic's A2P registration is already approved." };
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
      submissionStep: null,
      submittedAt: null,
      submittedByEmail: null,
      lastStatusSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      rejectionReason: null,
      customerProfileSid: null,
      trustProductSid: null,
      brandRegistrationSid: null,
      campaignSid: null,
      messagingServiceSid: null,
      customerProfileStatus: null,
      trustProductStatus: null,
      brandStatus: null,
      campaignStatus: null,
    },
    submissionMode,
    realSubmissionEnabled,
    liveSubmitArmed: false,
    liveSubmitBlockedReason: "Clinic not found.",
    campaign: buildCampaignContent(null),
    providerPayload: { resources: [] },
    plannedResources: [],
    feesRiskNotice: [],
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
