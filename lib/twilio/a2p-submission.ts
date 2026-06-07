import { getTwilioClient } from "./client";
import { planCustomerProfileRecovery } from "./a2p-recovery";
import { readConfiguredPlatformCustomerProfile } from "./platform-customer-profile";
import {
  bindTrustHubListMethod,
  requireTrustHubEvaluationStatus,
} from "./trusthub-helpers";
import {
  getA2pBrandConfig,
  getA2pTrustHubConfig,
  getAppDomainsSafe,
  getTwilioMessagingEnv,
  getTwilioServerEnv,
  isClinicAllowedForLiveA2pSubmit,
} from "../env";
import { findClinicById } from "../db/clinics";
import { listActiveSmsNumbersForClinic } from "../db/sms-readiness";
import {
  getA2pSubmissionState,
  upsertA2pSubmissionProgress,
} from "../db/a2p-submissions";
import { buildCampaignContent } from "../a2p/campaign-content";
import {
  formatEinForTwilio,
  mapBusinessTypeForTwilio,
  mapJobPositionForTwilio,
} from "../a2p/validation";
import {
  addressParams,
  buildA2pMessagingProfileEndUserPayload,
  buildA2pTrustProductCreatePayload,
  buildBrandRegistrationPayload,
  buildBusinessEndUserPayload,
  buildCampaignCreatePayload,
  buildCustomerProfileEvaluationPayload,
  buildMessagingServiceSenderPayload,
  buildRepresentativeEndUserPayload,
  buildSecondaryCustomerProfileCreatePayload,
  buildSupportingDocumentPayload,
  buildTrustProductEvaluationPayload,
} from "../a2p/provider-payload";
import type { A2pSubmissionStatus, JsonObject } from "../a2p/types";
import { logger } from "../logging/logger";

// Real Twilio A2P/10DLC submission, performed ONLY when a platform admin clicks
// Submit after reviewing the package and live mode is armed for the clinic.
//
// SDK surface verified against twilio@5.13.1 type definitions; policy SIDs and
// the Trust Hub onboarding sequence verified against Twilio's A2P 10DLC ISV API
// onboarding docs. The flow is idempotent + resumable: created SIDs are persisted
// after each step and reused on retry, so a single click runs every currently
// allowed step and the workflow stops-and-persists at any async/pending point.
//
// Standard ISV order (twilio.com/docs/messaging/compliance/a2p-10dlc):
//   EndUser(business) + EndUser(rep) + Address + SupportingDocument
//   -> Secondary Customer Profile (assign entities + primary profile, evaluate, submit)
//   -> A2P Trust Product (assign a2p-profile EndUser + secondary profile, evaluate, submit)
//   -> Brand Registration (references both bundles; async vetting)
//   -> A2P Campaign / UsAppToPerson (requires APPROVED brand; async)
//   -> add numbers as Messaging Service senders (after campaign approval)
//
// Real submission creates BILLABLE, externally-vetted, hard-to-reverse resources.
// The full EIN/tax id is sent to Twilio (business_registration_number) but is
// NEVER logged or persisted to provider_state / payload_snapshot.

export class A2pSubmissionDisabledError extends Error {
  readonly code = "a2p_real_submission_disabled";
  constructor(reason: string) {
    super(reason);
    this.name = "A2pSubmissionDisabledError";
  }
}

export class A2pSubmissionPersistError extends Error {
  readonly code = "a2p_submission_persist_failed";
  readonly requiresRecovery: boolean;

  constructor(message: string, requiresRecovery: boolean) {
    super(message);
    this.name = "A2pSubmissionPersistError";
    this.requiresRecovery = requiresRecovery;
  }
}

export type A2pCreatedResource = { key: string; sid: string; reused: boolean };

export type A2pSubmissionResult = {
  ok: boolean;
  status: A2pSubmissionStatus;
  step: string;
  message: string;
  createdResources: A2pCreatedResource[];
  providerErrors: string[];
  nextAction: string | null;
};

export type RealA2pSubmissionInput = {
  clinicId: string;
  adminUserId: string | null;
  adminEmail: string;
};

// ---------- isolated typed Twilio surfaces (only what we call) ----------

type TrustHubEntityAssignmentList = {
  create(p: { objectSid: string }): Promise<{ sid: string }>;
  list?(p: { limit: number }): Promise<Array<{ sid?: string | null; objectSid?: string | null; object_sid?: string | null }>>;
};
type TrustHubEvaluationList = {
  create(p: { policySid: string }): Promise<{ sid: string; status?: string | null }>;
};
type BundleContext = {
  fetch(): Promise<{ sid: string; status: string }>;
  update(p: { status?: string }): Promise<{ sid: string; status: string }>;
};
type CustomerProfileContext = BundleContext & {
  customerProfilesEntityAssignments: TrustHubEntityAssignmentList;
  customerProfilesEvaluations: TrustHubEvaluationList;
};
type TrustProductContext = BundleContext & {
  trustProductsEntityAssignments: TrustHubEntityAssignmentList;
  trustProductsEvaluations: TrustHubEvaluationList;
};
interface CustomerProfilesList {
  (sid: string): CustomerProfileContext;
  create(p: { friendlyName: string; email: string; policySid: string }): Promise<{ sid: string; status: string }>;
}
interface TrustProductsList {
  (sid: string): TrustProductContext;
  create(p: { friendlyName: string; email: string; policySid: string }): Promise<{ sid: string; status: string }>;
}
type EndUsersList = {
  create(p: { friendlyName: string; type: string; attributes?: Record<string, unknown> }): Promise<{ sid: string }>;
};
type SupportingDocumentsList = {
  create(p: { friendlyName: string; type: string; attributes?: Record<string, unknown> }): Promise<{ sid: string }>;
};
type TrustHubV1 = {
  customerProfiles: CustomerProfilesList;
  trustProducts: TrustProductsList;
  endUsers: EndUsersList;
  supportingDocuments: SupportingDocumentsList;
  policies: {
    (sid: string): {
      fetch(): Promise<{ sid: string; friendlyName?: string | null; friendly_name?: string | null }>;
    };
  };
};
type AddressesList = {
  create(p: {
    customerName: string;
    street: string;
    city: string;
    region: string;
    postalCode: string;
    isoCountry: string;
    streetSecondary?: string;
  }): Promise<{ sid: string }>;
};
type BrandContext = { fetch(): Promise<{ sid: string; status: string; failureReason?: string | null }> };
interface BrandRegistrationsList {
  (sid: string): BrandContext;
  create(p: {
    customerProfileBundleSid: string;
    a2PProfileBundleSid: string;
    brandType?: string;
  }): Promise<{ sid: string; status: string }>;
}
type UsAppToPersonList = {
  create(p: {
    brandRegistrationSid: string;
    description: string;
    messageFlow: string;
    messageSamples: string[];
    usAppToPersonUsecase: string;
    hasEmbeddedLinks: boolean;
    hasEmbeddedPhone: boolean;
  }): Promise<{ sid: string; campaignStatus?: string | null }>;
  list(p: { limit: number }): Promise<Array<{ sid?: string | null; campaignStatus?: string | null }>>;
};
type ServicePhoneNumberList = {
  create(p: { phoneNumberSid: string }): Promise<{ sid: string }>;
  list(p: { limit: number }): Promise<Array<{ phoneNumberSid?: string | null }>>;
};
type MessagingServiceContext = { usAppToPerson: UsAppToPersonList; phoneNumbers: ServicePhoneNumberList };
type MessagingV1 = {
  brandRegistrations: BrandRegistrationsList;
  services(sid: string): MessagingServiceContext;
};
type TwilioLike = {
  trusthub: { v1: TrustHubV1 };
  messaging: { v1: MessagingV1 };
  addresses: AddressesList;
};

function getClient(): TwilioLike {
  // Validate Twilio credentials are present (throws a clear error otherwise).
  getTwilioServerEnv();
  return getTwilioClient() as unknown as TwilioLike;
}

function str(state: JsonObject, key: string): string | null {
  const v = state[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function safeProviderError(err: unknown): { code: string | null; message: string } {
  const code = (err as { code?: string | number; status?: string | number })?.code
    ?? (err as { status?: string | number })?.status
    ?? null;
  const message = err instanceof Error ? err.message.slice(0, 500) : "unknown_provider_error";
  return { code: code != null ? String(code) : null, message };
}

function normalizeObjectSidList(
  values: Array<{ objectSid?: string | null; object_sid?: string | null }>,
): string[] {
  return Array.from(new Set(values
    .map((value) => value.objectSid ?? value.object_sid ?? null)
    .filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function resetCustomerProfileProgress(state: JsonObject): void {
  delete state.customerProfileSid;
  delete state.customerProfileEvaluation;
  delete state.customerProfileStatus;
  delete state.cpAssignmentsDone;
  delete state.cpSubmitted;
  delete state.a2pProfileEndUserSid;
  delete state.trustProductSid;
  delete state.trustProductEvaluation;
  delete state.trustProductStatus;
  delete state.tpAssignmentsDone;
  delete state.tpSubmitted;
  delete state.brandRegistrationSid;
  delete state.brandStatus;
  delete state.campaignSid;
  delete state.campaignStatus;
  delete state.numbersAdded;
}

// Entry point. Performs every currently-allowed step, persisting progress, and
// returns a structured result. Never sends SMS, never enables sms_recovery.
export async function runRealA2pSubmission(
  input: RealA2pSubmissionInput,
): Promise<A2pSubmissionResult> {
  const { clinicId, adminUserId, adminEmail } = input;

  // Hard gate: live mode + per-clinic allowlist + configured primary profile.
  if (!isClinicAllowedForLiveA2pSubmit(clinicId)) {
    throw new A2pSubmissionDisabledError(
      "Real A2P submission is not armed for this clinic (live mode + allowlist required).",
    );
  }
  const trustHub = getA2pTrustHubConfig();
  if (!trustHub.primaryCustomerProfileSid) {
    throw new A2pSubmissionDisabledError(
      "No primary Customer Profile SID configured. Set runtimeConfig.a2p.trustHub.primaryCustomerProfileSid before live submission.",
    );
  }

  const clinic = await findClinicById(clinicId);
  if (!clinic) throw new A2pSubmissionDisabledError("Clinic not found.");

  const brandCfg = getA2pBrandConfig();
  // Target Messaging Service from committed config (the service the campaign is
  // linked to and the clinic's numbers are added to as senders).
  const targetMsSid = getTwilioMessagingEnv().TWILIO_MESSAGING_SERVICE_SID;

  // A2P 10DLC applies to LOCAL numbers only. Toll-free numbers use toll-free
  // verification and must never be added as senders on the local A2P campaign.
  const activeNumbers = (await listActiveSmsNumbersForClinic(clinicId)).filter(
    (n) => n.number_type === "local",
  );
  const ein = formatEinForTwilio(clinic.ein_tax_id ?? "");
  const businessType = mapBusinessTypeForTwilio(clinic.business_type ?? "");
  const jobPosition = mapJobPositionForTwilio(clinic.a2p_rep_business_title ?? "");
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
  const businessPageUrl = appBaseUrl && clinic.slug ? `${appBaseUrl}/business/${clinic.slug}` : "";

  // Load prior progress (idempotent resume).
  const { record } = await getA2pSubmissionState(clinicId);
  const state: JsonObject = { ...(record?.providerState ?? {}) };

  const created: A2pCreatedResource[] = [];
  const errors: string[] = [];
  const client = getClient();
  const th = client.trusthub.v1;

  // Persist accumulated state + key SIDs after each milestone.
  async function persist(
    status: A2pSubmissionStatus,
    step: string,
    extra: Partial<{
      customerProfileSid: string | null;
      trustProductSid: string | null;
      brandRegistrationSid: string | null;
      campaignSid: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
      rejectionReason: string | null;
      replaceProviderState: boolean;
    }> = {},
  ): Promise<void> {
    try {
      await upsertA2pSubmissionProgress({
        clinicId,
        status,
        submissionStep: step,
        providerStatePatch: { ...state, lastStep: step },
        replaceProviderState: extra.replaceProviderState === true,
        targetMessagingServiceSid: targetMsSid,
        secondaryCustomerProfileSid: extra.customerProfileSid ?? str(state, "customerProfileSid"),
        customerProfileSid: extra.customerProfileSid ?? str(state, "customerProfileSid"),
        trustProductSid: extra.trustProductSid ?? str(state, "trustProductSid"),
        brandRegistrationSid: extra.brandRegistrationSid ?? str(state, "brandRegistrationSid"),
        campaignSid: extra.campaignSid ?? str(state, "campaignSid"),
        messagingServiceSid: targetMsSid,
        selectedPhoneNumbers: activeNumbers.map((n) => ({
          phoneNumber: n.phone_number,
          twilioPhoneNumberSid: n.twilio_phone_number_sid,
        })),
        submittedAt: new Date(),
        submittedByAdminUserId: adminUserId,
        submittedByAdminEmail: adminEmail,
        lastErrorCode: extra.lastErrorCode ?? null,
        lastErrorMessage: extra.lastErrorMessage ?? null,
        rejectionReason: extra.rejectionReason ?? null,
      });
    } catch (err) {
      logger.error("a2p.submit.persist_failed", {
        clinicId,
        step,
        submissionMode: "live",
        requestId: clinicId,
        createdCount: created.length,
        requires_recovery: created.length > 0,
        safeErrorMessage: err instanceof Error ? err.message.slice(0, 300) : "persist_failed",
      });
      throw new A2pSubmissionPersistError(
        created.length > 0
          ? "A2P provider step may have created resources, but local state could not be recorded. Do not retry until provider state is checked."
          : "A2P submission progress could not be recorded before provider state changed.",
        created.length > 0,
      );
    }
  }

  function fail(step: string, err: unknown): A2pSubmissionResult {
    const safe = safeProviderError(err);
    errors.push(safe.message);
    logger.error("a2p.submit.step_failed", {
      clinicId,
      step,
      submissionMode: "live",
      requestId: clinicId,
      safeErrorMessage: safe.message,
      twilioErrorCode: safe.code,
      createdCount: created.length,
    });
    return {
      ok: false,
      status: "failed",
      step,
      message: `A2P submission failed at step: ${step}.`,
      createdResources: created,
      providerErrors: errors,
      nextAction: "Review the provider error, fix the data, and retry. Created resources are reused on retry.",
    };
  }

  try {
    logger.info("a2p.submit.provider_call_started", {
      clinicId,
      step: "provider_call",
      submissionMode: "live",
      requestId: clinicId,
      createdCount: created.length,
    });
    const platformProfile = await readConfiguredPlatformCustomerProfile(
      client,
      trustHub.primaryCustomerProfileSid,
    );
    state.configuredPlatformCustomerProfileSid = trustHub.primaryCustomerProfileSid;
    state.platformCustomerProfileFriendlyName = platformProfile.diagnostics.friendlyName;
    state.platformCustomerProfileStatus = platformProfile.diagnostics.status;
    state.platformCustomerProfilePolicySid = platformProfile.diagnostics.policySid;
    state.platformCustomerProfilePolicyName = platformProfile.diagnostics.policyFriendlyName;
    state.platformCustomerProfileKind = platformProfile.diagnostics.profileKind;
    state.platformCustomerProfileValidatedAt = new Date().toISOString();
    if (!platformProfile.ok) {
      state.platformCustomerProfileValidationCode = platformProfile.code;
      state.platformCustomerProfileValidationMessage = platformProfile.message;
      await persist("blocked", "platform_customer_profile_preflight_failed", {
        lastErrorCode: platformProfile.code ?? "TWILIO_PLATFORM_CUSTOMER_PROFILE_INVALID",
        lastErrorMessage: platformProfile.message,
      });
      return {
        ok: false,
        status: "blocked",
        step: "platform_customer_profile_preflight",
        message: platformProfile.message ?? "Configured Twilio platform customer profile is invalid.",
        createdResources: created,
        providerErrors: platformProfile.message ? [platformProfile.message] : [],
        nextAction:
          "Fix the configured platform Primary Customer Profile, then retry the A2P submission.",
      };
    }
    if (!businessType || !jobPosition || !ein) {
      throw new Error("A2P provider payload is incomplete after normalization.");
    }
    // ---- 1. business information EndUser ----
    let businessEndUserSid = str(state, "businessEndUserSid");
    if (!businessEndUserSid) {
      const businessPayload = buildBusinessEndUserPayload({
        clinicName: clinic.name,
        businessName: clinic.legal_business_name ?? clinic.name,
        businessType,
        industry: brandCfg.businessIndustry,
        registrationIdentifier: brandCfg.businessRegistrationIdentifier,
        businessRegistrationNumber: ein,
        regionsOfOperation: brandCfg.regionsOfOperation,
        identity: brandCfg.businessIdentity,
        websiteUrl: businessPageUrl,
      });
      const eu = await th.endUsers.create({
        friendlyName: businessPayload.friendlyName,
        type: businessPayload.type,
        attributes: businessPayload.attributes,
      });
      businessEndUserSid = eu.sid;
      state.businessEndUserSid = businessEndUserSid;
      created.push({ key: "business_end_user", sid: businessEndUserSid, reused: false });
      await persist("submitted", "business_end_user_created");
    }

    // ---- 2. authorized representative EndUser ----
    let repEndUserSid = str(state, "repEndUserSid");
    if (!repEndUserSid) {
      const representativePayload = buildRepresentativeEndUserPayload({
        clinicName: clinic.name,
        firstName: clinic.a2p_rep_first_name ?? "",
        lastName: clinic.a2p_rep_last_name ?? "",
        email: clinic.a2p_rep_email ?? "",
        phone: clinic.a2p_rep_phone ?? "",
        jobPosition,
        businessTitle: clinic.a2p_rep_business_title ?? "",
      });
      const eu = await th.endUsers.create({
        friendlyName: representativePayload.friendlyName,
        type: representativePayload.type,
        attributes: representativePayload.attributes,
      });
      repEndUserSid = eu.sid;
      state.repEndUserSid = repEndUserSid;
      created.push({ key: "rep_end_user", sid: repEndUserSid, reused: false });
      await persist("submitted", "rep_end_user_created");
    }

    // ---- 3. Address + SupportingDocument (customer_profile_address) ----
    let addressSid = str(state, "addressSid");
    if (!addressSid) {
      const addr = await client.addresses.create(addressParams({
        customerName: clinic.legal_business_name ?? clinic.name,
        street: clinic.street_address ?? "",
        addressLine2: clinic.address_line2,
        city: clinic.city ?? "",
        region: clinic.state_region ?? "",
        postalCode: clinic.postal_code ?? "",
        isoCountry: clinic.country ?? "US",
      }));
      addressSid = addr.sid;
      state.addressSid = addressSid;
      created.push({ key: "address", sid: addressSid, reused: false });
      await persist("submitted", "address_created");
    }
    let supportingDocumentSid = str(state, "supportingDocumentSid");
    if (!supportingDocumentSid) {
      const supportingDocumentPayload = buildSupportingDocumentPayload({
        clinicName: clinic.name,
        addressSid,
      });
      const doc = await th.supportingDocuments.create({
        friendlyName: supportingDocumentPayload.friendlyName,
        type: supportingDocumentPayload.type,
        attributes: supportingDocumentPayload.attributes,
      });
      supportingDocumentSid = doc.sid;
      state.supportingDocumentSid = supportingDocumentSid;
      created.push({ key: "supporting_document", sid: supportingDocumentSid, reused: false });
      await persist("submitted", "supporting_document_created");
    }

    // ---- 4. Secondary Customer Profile ----
    let customerProfileSid = str(state, "customerProfileSid");
    let customerProfileAssignedObjectSids = new Set<string>();
    if (customerProfileSid) {
      const cpCtx = th.customerProfiles(customerProfileSid);
      state.lastStep = "customer_profile_assignment_lookup";
      const listAssignments = bindTrustHubListMethod(cpCtx.customerProfilesEntityAssignments);
      if (!listAssignments && state.cpAssignmentsDone === true) {
        throw new Error(
          "Could not verify existing Twilio customer profile assignments for safe retry.",
        );
      }
      const assignmentList = listAssignments
        ? await listAssignments({ limit: 50 })
        : [];
      const assignedObjectSids = normalizeObjectSidList(assignmentList ?? []);
      const recoveryPlan = planCustomerProfileRecovery({
        customerProfileSid,
        cpAssignmentsDone: state.cpAssignmentsDone === true,
        currentPlatformCustomerProfileSid: trustHub.primaryCustomerProfileSid,
        assignedObjectSids,
        trustProductSid: str(state, "trustProductSid"),
        brandRegistrationSid: str(state, "brandRegistrationSid"),
        campaignSid: str(state, "campaignSid"),
      });

      state.customerProfileRecoveryAction = recoveryPlan.action;
      state.customerProfileRecoveryReason = recoveryPlan.reason;
      state.assignedPlatformCustomerProfileSid = recoveryPlan.assignedPlatformCustomerProfileSid;

      if (recoveryPlan.action === "manual_review") {
        await persist("blocked", "customer_profile_recovery_required", {
          customerProfileSid,
          lastErrorCode: "A2P_CUSTOMER_PROFILE_RECOVERY_REQUIRED",
          lastErrorMessage: recoveryPlan.reason,
        });
        return {
          ok: false,
          status: "blocked",
          step: "customer_profile_recovery",
          message: recoveryPlan.reason,
          createdResources: created,
          providerErrors: [recoveryPlan.reason],
          nextAction:
            "Review the existing Twilio A2P resources before retrying this clinic.",
        };
      }

      if (recoveryPlan.action === "rebuild") {
        state.staleCustomerProfileSid = customerProfileSid;
        resetCustomerProfileProgress(state);
        state.customerProfileRecoveryAction = recoveryPlan.action;
        state.customerProfileRecoveryReason = recoveryPlan.reason;
        state.assignedPlatformCustomerProfileSid = recoveryPlan.assignedPlatformCustomerProfileSid;
        customerProfileSid = null;
        await persist("submitted", "customer_profile_rebuild_planned", {
          replaceProviderState: true,
        });
      } else {
        customerProfileAssignedObjectSids = new Set(assignedObjectSids);
      }
    }
    if (!customerProfileSid) {
      const customerProfilePayload = buildSecondaryCustomerProfileCreatePayload({
        clinicName: clinic.name,
        notificationEmail: trustHub.notificationEmail,
        policySid: trustHub.customerProfilePolicySid,
      });
      const cp = await th.customerProfiles.create({
        friendlyName: customerProfilePayload.friendlyName,
        email: customerProfilePayload.email,
        policySid: customerProfilePayload.policySid,
      });
      customerProfileSid = cp.sid;
      state.customerProfileSid = customerProfileSid;
      state.assignedPlatformCustomerProfileSid = null;
      created.push({ key: "secondary_customer_profile", sid: customerProfileSid, reused: false });
      await persist("submitted", "customer_profile_created", { customerProfileSid });
    }

    // ---- 5. assign entities to the Customer Profile (idempotent flag) ----
    const requiredCustomerProfileAssignments = [
      businessEndUserSid,
      repEndUserSid,
      supportingDocumentSid,
      trustHub.primaryCustomerProfileSid,
    ];
    const missingCustomerProfileAssignments = requiredCustomerProfileAssignments.filter(
      (objectSid) => !customerProfileAssignedObjectSids.has(objectSid),
    );
    if (state.cpAssignmentsDone !== true || missingCustomerProfileAssignments.length > 0) {
      const cpCtx = th.customerProfiles(customerProfileSid);
      state.lastStep = "customer_profile_assignment";
      for (const objectSid of missingCustomerProfileAssignments) {
        await cpCtx.customerProfilesEntityAssignments.create({ objectSid });
        customerProfileAssignedObjectSids.add(objectSid);
      }
      state.cpAssignmentsDone = true;
      state.assignedPlatformCustomerProfileSid = trustHub.primaryCustomerProfileSid;
      await persist("submitted", "customer_profile_assigned", { customerProfileSid });
    }

    // ---- 6 + 7. evaluate + submit the Customer Profile ----
    if (state.cpSubmitted !== true) {
      const cpCtx = th.customerProfiles(customerProfileSid);
      state.lastStep = "customer_profile_evaluation";
      const evalResult = await cpCtx.customerProfilesEvaluations.create(
        buildCustomerProfileEvaluationPayload({
          policySid: trustHub.customerProfilePolicySid,
        }),
      );
      const customerProfileEvaluationStatus = requireTrustHubEvaluationStatus(
        evalResult,
        "Customer Profile",
      );
      state.customerProfileEvaluation = customerProfileEvaluationStatus;
      if (customerProfileEvaluationStatus.toLowerCase() !== "compliant") {
        await persist("blocked", "customer_profile_evaluation_failed", { customerProfileSid });
        return {
          ok: false,
          status: "blocked",
          step: "customer_profile_evaluation",
          message: "The Customer Profile did not pass evaluation. Review the Twilio evaluation details and platform profile wiring.",
          createdResources: created,
          providerErrors: errors,
          nextAction: "Review the Twilio evaluation details, correct the blocking profile data or platform wiring, then retry submission.",
        };
      }
      await cpCtx.update({ status: "pending-review" });
      state.cpSubmitted = true;
      state.customerProfileStatus = "pending-review";
      await persist("pending", "customer_profile_submitted", { customerProfileSid });
    }

    // ---- 8. A2P messaging profile EndUser ----
    let a2pProfileEndUserSid = str(state, "a2pProfileEndUserSid");
    if (!a2pProfileEndUserSid) {
      const a2pProfilePayload = buildA2pMessagingProfileEndUserPayload({
        clinicName: clinic.name,
        companyType: brandCfg.companyType,
      });
      const eu = await th.endUsers.create({
        friendlyName: a2pProfilePayload.friendlyName,
        type: a2pProfilePayload.type,
        attributes: a2pProfilePayload.attributes,
      });
      a2pProfileEndUserSid = eu.sid;
      state.a2pProfileEndUserSid = a2pProfileEndUserSid;
      created.push({ key: "a2p_profile_end_user", sid: a2pProfileEndUserSid, reused: false });
      await persist("pending", "a2p_profile_end_user_created", { customerProfileSid });
    }

    // ---- 9. A2P Trust Product ----
    let trustProductSid = str(state, "trustProductSid");
    if (!trustProductSid) {
      const trustProductPayload = buildA2pTrustProductCreatePayload({
        clinicName: clinic.name,
        notificationEmail: trustHub.notificationEmail,
        policySid: trustHub.a2pTrustProductPolicySid,
      });
      const tp = await th.trustProducts.create({
        friendlyName: trustProductPayload.friendlyName,
        email: trustProductPayload.email,
        policySid: trustProductPayload.policySid,
      });
      trustProductSid = tp.sid;
      state.trustProductSid = trustProductSid;
      created.push({ key: "a2p_trust_product", sid: trustProductSid, reused: false });
      await persist("pending", "trust_product_created", { customerProfileSid, trustProductSid });
    }

    // ---- 10. assign a2p-profile EndUser + secondary profile to Trust Product ----
    if (state.tpAssignmentsDone !== true) {
      const tpCtx = th.trustProducts(trustProductSid);
      for (const objectSid of [a2pProfileEndUserSid, customerProfileSid]) {
        await tpCtx.trustProductsEntityAssignments.create({ objectSid });
      }
      state.tpAssignmentsDone = true;
      await persist("pending", "trust_product_assigned", { customerProfileSid, trustProductSid });
    }

    // ---- 11 + 12. evaluate + submit the Trust Product ----
    if (state.tpSubmitted !== true) {
      const tpCtx = th.trustProducts(trustProductSid);
      state.lastStep = "trust_product_evaluation";
      const evalResult = await tpCtx.trustProductsEvaluations.create(
        buildTrustProductEvaluationPayload({
          policySid: trustHub.a2pTrustProductPolicySid,
        }),
      );
      const trustProductEvaluationStatus = requireTrustHubEvaluationStatus(
        evalResult,
        "Trust Product",
      );
      state.trustProductEvaluation = trustProductEvaluationStatus;
      if (trustProductEvaluationStatus.toLowerCase() !== "compliant") {
        await persist("blocked", "trust_product_evaluation_failed", { customerProfileSid, trustProductSid });
        return {
          ok: false,
          status: "blocked",
          step: "trust_product_evaluation",
          message: "The A2P Trust Product did not pass evaluation.",
          createdResources: created,
          providerErrors: errors,
          nextAction: "Correct the A2P messaging profile data, then retry submission.",
        };
      }
      await tpCtx.update({ status: "pending-review" });
      state.tpSubmitted = true;
      state.trustProductStatus = "pending-review";
      await persist("pending", "trust_product_submitted", { customerProfileSid, trustProductSid });
    }

    // ---- 13. Brand Registration (async vetting) ----
    let brandSid = str(state, "brandRegistrationSid");
    let brandStatus = str(state, "brandStatus");
    if (!brandSid) {
      const brand = await client.messaging.v1.brandRegistrations.create(
        buildBrandRegistrationPayload({
          customerProfileSid,
          trustProductSid,
        }),
      );
      brandSid = brand.sid;
      brandStatus = brand.status;
      state.brandRegistrationSid = brandSid;
      state.brandStatus = brandStatus;
      created.push({ key: "brand_registration", sid: brandSid, reused: false });
      await persist("pending", "brand_registration_created", { customerProfileSid, trustProductSid, brandRegistrationSid: brandSid });
    } else {
      const brand = await client.messaging.v1.brandRegistrations(brandSid).fetch();
      brandStatus = brand.status;
      state.brandStatus = brandStatus;
    }

    if ((brandStatus ?? "").toUpperCase() !== "APPROVED") {
      await persist("pending", "awaiting_brand_approval", { customerProfileSid, trustProductSid, brandRegistrationSid: brandSid });
      return {
        ok: true,
        status: "pending",
        step: "awaiting_brand_approval",
        message: `Submitted. Brand registration status is ${brandStatus ?? "PENDING"}. Twilio vetting is asynchronous.`,
        createdResources: created,
        providerErrors: errors,
        nextAction: "Run the read-only A2P status refresh later. Once the brand is APPROVED, click Submit again to create the campaign and add numbers.",
      };
    }

    // ---- 14. A2P Campaign / UsAppToPerson (requires APPROVED brand) ----
    const content = buildCampaignContent(clinic.name);
    const svc = client.messaging.v1.services(targetMsSid);
    let campaignSid = str(state, "campaignSid");
    let campaignStatus = str(state, "campaignStatus");
    if (!campaignSid) {
      // Reuse an existing campaign on the service if one is already present.
      const existing = await svc.usAppToPerson.list({ limit: 1 }).catch(() => []);
      if (existing[0]?.sid) {
        campaignSid = existing[0].sid ?? null;
        campaignStatus = existing[0].campaignStatus ?? null;
        if (campaignSid) created.push({ key: "campaign", sid: campaignSid, reused: true });
      } else {
        const campaign = await svc.usAppToPerson.create(
          buildCampaignCreatePayload({
            brandRegistrationSid: brandSid,
            campaign: content,
          }),
        );
        campaignSid = campaign.sid;
        campaignStatus = campaign.campaignStatus ?? null;
        created.push({ key: "campaign", sid: campaignSid, reused: false });
      }
      state.campaignSid = campaignSid;
      state.campaignStatus = campaignStatus;
      await persist("pending", "campaign_created", { customerProfileSid, trustProductSid, brandRegistrationSid: brandSid, campaignSid });
    }

    // ---- 15. add active numbers as Messaging Service senders ----
    const alreadyAdded = new Set(
      Array.isArray(state.numbersAdded) ? (state.numbersAdded as unknown[]).filter((x): x is string => typeof x === "string") : [],
    );
    const existingSenders = await svc.phoneNumbers.list({ limit: 1000 }).catch(() => []);
    for (const sid of existingSenders) {
      if (sid.phoneNumberSid) alreadyAdded.add(sid.phoneNumberSid);
    }
    for (const n of activeNumbers) {
      const pn = n.twilio_phone_number_sid;
      if (!pn || alreadyAdded.has(pn)) continue;
      try {
        await svc.phoneNumbers.create(buildMessagingServiceSenderPayload({ phoneNumberSid: pn }));
        alreadyAdded.add(pn);
        created.push({ key: "messaging_service_sender", sid: pn, reused: false });
      } catch (err) {
        errors.push(`add_sender ${pn}: ${err instanceof Error ? err.message.slice(0, 200) : "error"}`);
      }
    }
    state.numbersAdded = Array.from(alreadyAdded);

    const campaignApproved = (campaignStatus ?? "").toUpperCase() === "VERIFIED" || (campaignStatus ?? "").toUpperCase() === "APPROVED";
    const finalStatus: A2pSubmissionStatus = campaignApproved ? "approved" : "pending";
    await persist(finalStatus, campaignApproved ? "completed" : "awaiting_campaign_approval", {
      customerProfileSid,
      trustProductSid,
      brandRegistrationSid: brandSid,
      campaignSid,
    });

    return {
      ok: true,
      status: finalStatus,
      step: campaignApproved ? "completed" : "awaiting_campaign_approval",
      message: campaignApproved
        ? "Brand approved and campaign active. Run the read-only readiness sync to confirm per-number coverage."
        : `Campaign created (status ${campaignStatus ?? "PENDING"}). Numbers will become covered once the campaign is approved.`,
      createdResources: created,
      providerErrors: errors,
      nextAction: campaignApproved
        ? "Run the read-only readiness sync; confirm production_safe per number before enabling SMS."
        : "Run the read-only A2P status refresh later to track campaign approval.",
    };
  } catch (err) {
    const code = (err as { code?: string | number })?.code;
    const result = fail(str(state, "lastStep") ?? "provider_call", err);
    await upsertA2pSubmissionProgress({
      clinicId,
      status: "failed",
      submissionStep: result.step,
      providerStatePatch: { ...state },
      submittedByAdminUserId: adminUserId,
      submittedByAdminEmail: adminEmail,
      lastErrorCode: code != null ? String(code) : "provider_error",
      lastErrorMessage: err instanceof Error ? err.message.slice(0, 500) : "unknown",
    }).catch(() => {});
    return result;
  }
}

// Read-only provider status refresh. Fetches the stored Customer Profile, Trust
// Product, Brand, and Campaign by SID and updates local status only. Creates
// nothing and mutates no provider state. Safe to run any time.
export async function readA2pProviderStatus(clinicId: string): Promise<{
  ok: boolean;
  statuses: Record<string, string>;
}> {
  const { record } = await getA2pSubmissionState(clinicId);
  if (!record) return { ok: false, statuses: {} };
  const client = getClient();
  const statuses: Record<string, string> = {};
  const patch: JsonObject = {};

  await refresh(record.twilioSecondaryCustomerProfileSid ?? record.twilioCustomerProfileSid, async (sid) => {
    const r = await client.trusthub.v1.customerProfiles(sid).fetch();
    statuses.customerProfile = r.status;
    patch.customerProfileStatus = r.status;
  });
  await refresh(record.twilioTrustProductSid, async (sid) => {
    const r = await client.trusthub.v1.trustProducts(sid).fetch();
    statuses.trustProduct = r.status;
    patch.trustProductStatus = r.status;
  });
  await refresh(record.twilioBrandRegistrationSid, async (sid) => {
    const r = await client.messaging.v1.brandRegistrations(sid).fetch();
    statuses.brand = r.status;
    patch.brandStatus = r.status;
  });

  if (Object.keys(patch).length > 0) {
    await upsertA2pSubmissionProgress({
      clinicId,
      providerStatePatch: patch,
      lastStatusSyncedAt: new Date(),
    }).catch(() => {});
  }
  return { ok: true, statuses };
}

async function refresh(sid: string | null, fn: (sid: string) => Promise<void>): Promise<void> {
  if (!sid) return;
  try {
    await fn(sid);
  } catch {
    // read-only; ignore individual fetch errors
  }
}

// Read-only status sync re-export kept for discoverability of the A2P lifecycle.
export { syncClinicSmsReadinessFromTwilio as syncA2pReadinessReadOnly } from "./sms-readiness-sync";
