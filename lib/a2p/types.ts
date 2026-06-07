// Shared, client-safe types for the platform-admin A2P/10DLC review workflow.
//
// This module has NO server imports (no DB/Twilio/env) so both the server-side
// package builder and the client admin panel can import it without pulling
// server-only code into the browser bundle.

// Local review/submission lifecycle status. Mirrors the DB check constraint in
// supabase/migrations/20260607000100_a2p_submission_tracking.sql.
export type A2pSubmissionStatus =
  | "draft"
  | "missing_info"
  | "ready_for_review"
  | "submit_disabled"
  | "dry_run_reviewed"
  | "ready_for_manual_submission"
  | "submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "failed"
  | "blocked";

export type A2pSubmissionMode = "disabled" | "dry_run" | "mock" | "live";
export type A2pStoredSubmissionMode = "dry_run" | "mock" | "live";

// JSON-safe value types for jsonb payloads (no `unknown`, no Date).
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// Fixed campaign content shown before submit and submitted to Twilio.
export type A2pCampaignContent = {
  usecase: string;
  description: string;
  messageFlow: string;
  sampleMessages: string[];
  hasEmbeddedLinks: boolean;
  hasEmbeddedPhone: boolean;
  optInStatement: string;
  stopHelpStatement: string;
};

// Per-number coverage as shown to the platform admin. Anything other than
// "covered" must be presented as "Not approved yet" / "Not covered yet".
export type NumberCoverageDisplay =
  | "covered"
  | "not_in_messaging_service"
  | "not_campaign_covered"
  | "readiness_missing"
  | "readiness_unavailable"
  | "stale"
  | "error"
  | "blocked"
  | "unknown";

export type A2pReviewNumber = {
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
  billingClass: string | null;
  // Raw provider-derived sub-statuses (covered / missing / unknown / error).
  messagingServiceSenderStatus: string;
  a2pCampaignCoverageStatus: string;
  // Single rolled-up display state used to pick a label/tone.
  coverageDisplay: NumberCoverageDisplay;
  // True ONLY when readiness confirms verified service + campaign + per-number
  // coverage, fresh, with no sync error. Never optimistic.
  approvedOrCovered: boolean;
  eligibleForLiveSms: boolean;
  blockingReason: string | null;
  lastSyncedAt: string | null;
};

export type A2pReviewMissingField = { key: string; label: string };

export type A2pSubmissionInfo = {
  // Whether the clinic_a2p_submissions table is reachable.
  trackingAvailable: boolean;
  status: A2pSubmissionStatus | null;
  mode: A2pSubmissionMode | null;
  submissionStep: string | null;
  submittedAt: string | null;
  submittedByEmail: string | null;
  lastStatusSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  rejectionReason: string | null;
  // Twilio resource SIDs created/reused so far (object references, not secrets).
  customerProfileSid: string | null;
  trustProductSid: string | null;
  brandRegistrationSid: string | null;
  campaignSid: string | null;
  messagingServiceSid: string | null;
  // Provider statuses read back by the read-only status refresh.
  customerProfileStatus: string | null;
  trustProductStatus: string | null;
  brandStatus: string | null;
  campaignStatus: string | null;
  // Brand registration failure details captured from Twilio provider response.
  brandFailureReason: string | null;
  brandFailureCode: string | null;
};

export type A2pTrackedSubmission = {
  mode: A2pStoredSubmissionMode;
  title: string;
  exists: boolean;
  submission: A2pSubmissionInfo;
  mock: boolean;
  nextAction: string | null;
};

// One Twilio resource the real submit will create (or reuse if already present).
export type A2pPlannedResource = {
  key: string;
  label: string;
  willCreate: boolean;
  reuseSid: string | null;
};

// "What will be submitted to Twilio" — minimal provider payload, grouped by
// Twilio resource/step. Contains ONLY fields that are actually submitted.
export type A2pPayloadField = { label: string; value: string };
export type A2pPayloadResource = { step: string; fields: A2pPayloadField[] };
export type A2pProviderPayloadView = { resources: A2pPayloadResource[] };

export type A2pIncludedSender = {
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
  includedInSubmission: boolean;
};

export type A2pIncludedSendersView = {
  numbers: A2pIncludedSender[];
};

export type A2pModeOption = {
  mode: A2pStoredSubmissionMode;
  label: string;
  helper: string;
  available: boolean;
  disabledReason: string | null;
  recommended: boolean;
};

export type A2pReviewBusiness = {
  legalBusinessName: string | null;
  businessType: string | null;
  businessTypeLabel: string | null;
  // EIN is never exposed in full. Presence + last 4 only.
  einProvided: boolean;
  einLast4: string | null;
  einMasked: string | null;
  einFormatValid: boolean;
  addressLine: string | null;
  website: string | null;
  mainPhone: string | null;
};

export type A2pReviewRepresentative = {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  authorized: boolean;
};

export type A2pReviewClinicReadiness = {
  messagingServiceStatus: string;
  brandStatus: string;
  campaignStatus: string;
  a2pStatus: string;
  lastSyncedAt: string | null;
  blockingReason: string | null;
};

export type A2pAuthorizationState = {
  submissionMode: A2pSubmissionMode;
  defaultMode: A2pSubmissionMode;
  modeOptions: A2pModeOption[];
  mockConfigured: boolean;
  mockMessagingServiceSid: string | null;
  realSubmissionEnabled: boolean;
  liveSubmitArmed: boolean;
  liveSubmitBlockedReason: string | null;
  reviewStatus: string;
  submitEligible: boolean;
  submitBlockedReason: string | null;
  feesRiskNotice: string[];
};

export type A2pInternalDiagnostics = {
  messagingServiceSid: string | null;
  clinicReadiness: A2pReviewClinicReadiness | null;
  submission: A2pSubmissionInfo;
  numberDiagnostics: A2pReviewNumber[];
  plannedResources: A2pPlannedResource[];
  warnings: string[];
  complianceUrls: {
    businessPage: string | null;
    privacyPolicy: string | null;
    smsTerms: string | null;
  };
};

export type A2pReviewPackage = {
  clinicId: string;
  clinicName: string;
  found: boolean;

  business: A2pReviewBusiness;
  representative: A2pReviewRepresentative;
  urls: {
    businessPage: string | null;
    privacyPolicy: string | null;
    smsTerms: string | null;
  };

  messagingServiceSid: string | null;

  // Readiness availability is a hard gate: when the readiness tables are not
  // reachable, the package degrades to "unavailable" and submit is blocked.
  readinessAvailable: boolean;
  clinicReadiness: A2pReviewClinicReadiness | null;
  // A2P 10DLC applies to LOCAL numbers only; `numbers` therefore lists only the
  // clinic's active LOCAL numbers. The counts let the admin UI explain when a
  // clinic has only toll-free numbers (no local A2P required).
  numbers: A2pReviewNumber[];
  localNumberCount: number;
  tollFreeActiveCount: number;

  missingFields: A2pReviewMissingField[];
  warnings: string[];

  // Fixed campaign content (use case, samples, opt-in, STOP/HELP) shown before
  // submit and submitted to Twilio.
  campaign: A2pCampaignContent;
  // Minimal provider payload — exactly what will be submitted to Twilio.
  providerPayload: A2pProviderPayloadView;
  includedSenders: A2pIncludedSendersView;
  submissions: {
    live: A2pTrackedSubmission;
    mock: A2pTrackedSubmission;
  };
  authorizationState: A2pAuthorizationState;
  internalDiagnostics: A2pInternalDiagnostics;
};
