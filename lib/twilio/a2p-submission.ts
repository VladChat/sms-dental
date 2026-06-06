// Future Twilio A2P/10DLC submission helper — NO LIVE MUTATION.
//
// ⚠️  Every function in this module is a guarded stub. None of them call a
//     mutating Twilio API. They THROW `A2pSubmissionDisabledError` by default so
//     that wiring them up accidentally can never create/modify provider state.
//
// This module exists to (a) document Twilio's real A2P/10DLC process in code,
// and (b) give a future, deliberate task a single, clearly-bounded place to
// implement real submission behind its own explicit gate. Implementing any of
// these for real is OUT OF SCOPE for the current sprint.
//
// ---------------------------------------------------------------------------
// Twilio A2P/10DLC standard registration order (for local US numbers):
//
//   1. Customer Profile (a.k.a. business/customer profile, Trust Hub)
//        - Primary Customer Profile with business identity, address, EIN/tax id,
//          and an authorized representative.
//        - A Secondary Customer Profile is used by ISVs/resellers representing
//          their end customers. Decide primary-vs-secondary before building.
//   2. Trust Product (A2P Trust Bundle)
//        - Links the Customer Profile to A2P messaging trust.
//   3. Brand Registration
//        - Registers the brand with TCR (The Campaign Registry). Has a one-time
//          fee and a vetting/approval lifecycle. Status must reach an approved
//          state before the brand can carry an approved campaign.
//   4. Campaign / Use Case (US App To Person)
//        - Registers the messaging use case (e.g. customer care / mixed) with
//          sample messages, opt-in details, and message flow. Has recurring
//          monthly carrier fees and a vetting/approval lifecycle.
//   5. Messaging Service
//        - The campaign is associated with a Messaging Service. The configured
//          service SID lives in committed runtime config.
//   6. Add phone numbers to the A2P Messaging Service
//        - Each sending number (PN SID) must be attached as a sender on the
//          Messaging Service that carries the approved campaign.
//   7. Status sync
//        - Brand/Campaign approval and per-number sender coverage are confirmed
//          by READ-ONLY status reads (see status-sync note below).
//
// Risks / fees / irreversibility to surface before enabling real submission:
//   - Brand registration incurs a one-time TCR fee.
//   - Campaign registration incurs recurring monthly carrier fees.
//   - Submissions enter external vetting; they cannot simply be "undone".
//   - Incorrect business identity (EIN, legal name, address) can cause rejection
//     and re-vetting fees/delays.
//   - These are external, billable, hard-to-reverse provider mutations and MUST
//     be confirmation-gated, platform-admin-only, audited, and disabled by
//     default behind an explicit server-side config flag before going live.
//
// API uncertainty to resolve at implementation time (do NOT guess now):
//   - Exact Twilio Node SDK call shapes for customerProfiles / trustProducts /
//     brandRegistrations / messaging service usAppToPerson differ by SDK version
//     and account type; verify against the installed `twilio` package and the
//     current Twilio docs before writing real calls.
// ---------------------------------------------------------------------------

export class A2pSubmissionDisabledError extends Error {
  readonly code = "a2p_real_submission_disabled";
  constructor(step: string) {
    super(
      `Real Twilio A2P submission is disabled in this build (step: ${step}). ` +
        "Implement this behind an explicit server-side gate before enabling.",
    );
    this.name = "A2pSubmissionDisabledError";
  }
}

export type A2pSubmissionContext = {
  clinicId: string;
  messagingServiceSid: string | null;
  selectedPhoneNumberSids: string[];
};

// Step 1 — Customer Profile (business identity). STUB: throws by default.
export async function submitCustomerProfile(_ctx: A2pSubmissionContext): Promise<never> {
  throw new A2pSubmissionDisabledError("customer_profile");
}

// Step 2 — Trust Product (A2P trust bundle). STUB: throws by default.
export async function submitTrustProduct(_ctx: A2pSubmissionContext): Promise<never> {
  throw new A2pSubmissionDisabledError("trust_product");
}

// Step 3 — Brand Registration (TCR). STUB: throws by default.
export async function submitBrandRegistration(_ctx: A2pSubmissionContext): Promise<never> {
  throw new A2pSubmissionDisabledError("brand_registration");
}

// Step 4 — Campaign / Use Case (US App To Person). STUB: throws by default.
export async function submitCampaign(_ctx: A2pSubmissionContext): Promise<never> {
  throw new A2pSubmissionDisabledError("campaign");
}

// Step 6 — Attach numbers to the A2P Messaging Service. STUB: throws by default.
// (This is a provider mutation and is explicitly forbidden in the current scope.)
export async function attachNumbersToMessagingService(_ctx: A2pSubmissionContext): Promise<never> {
  throw new A2pSubmissionDisabledError("attach_numbers");
}

// Step 7 — Status sync.
//
// The ONLY safe, already-implemented part of this lifecycle is the read-only
// status read. Use the existing read-only readiness sync — it fetches Messaging
// Service, sender, Brand, and Campaign status and writes only local readiness
// tables. It never mutates Twilio. Importers should call
// `syncClinicSmsReadinessFromTwilio(clinicId)` from `./sms-readiness-sync`
// directly; it is re-exported here only to keep the A2P lifecycle discoverable.
export { syncClinicSmsReadinessFromTwilio as syncA2pStatusReadOnly } from "./sms-readiness-sync";
