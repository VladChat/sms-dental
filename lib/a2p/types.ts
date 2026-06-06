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

export type A2pSubmissionMode = "disabled" | "dry_run" | "live";

// JSON-safe value types for jsonb payloads (no `unknown`, no Date).
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

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
  submittedAt: string | null;
  submittedByEmail: string | null;
  lastStatusSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  rejectionReason: string | null;
  brandRegistrationSid: string | null;
  campaignSid: string | null;
  messagingServiceSid: string | null;
};

export type A2pReviewBusiness = {
  legalBusinessName: string | null;
  businessType: string | null;
  businessTypeLabel: string | null;
  // EIN is never exposed in full. Presence + last 4 only.
  einProvided: boolean;
  einLast4: string | null;
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
  numbers: A2pReviewNumber[];

  missingFields: A2pReviewMissingField[];
  warnings: string[];

  submission: A2pSubmissionInfo;
  submissionMode: A2pSubmissionMode;
  // Always false in this build — real Twilio A2P submission is not implemented.
  realSubmissionEnabled: boolean;

  // Derived display status for the whole package.
  reviewStatus: string;
  submitEligible: boolean;
  submitBlockedReason: string | null;
};
