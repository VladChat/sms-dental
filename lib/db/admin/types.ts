// Shared types + pure redaction helpers for the platform admin console.
// No runtime side effects. Redaction: phone numbers are masked to the last 4
// digits; Twilio SIDs are shown as a short tail only; raw payloads/tokens/secrets
// are never surfaced.

export type AdminOverview = {
  totalClinics: number;
  activeClinics: number;
  inactiveClinics: number;
  smsRecoveryEnabled: number;
  smsRecoveryDisabled: number;
  withAssignedNumber: number;
  withoutAssignedNumber: number;
  recentCalls: number;
  recentMessageFailures: number;
  clinicsNeedingAction: number;
};

export type AdminClinicListItem = {
  id: string;
  name: string;
  ownerEmail: string | null;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  hasAssignedNumber: boolean;
  assignedPhoneMasked: string | null;
  billingStatus: string;
  setupStatus: string;
  smsStatus: string;
  localNumberStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminClinicFilters = {
  search?: string | null;
  active?: boolean | null;
  sms?: boolean | null;
  phone?: boolean | null;
};

export type AdminClinicMember = {
  email: string;
  role: string;
  status: string;
};

export type AdminClinicPhoneNumber = {
  id: string;
  phoneMasked: string | null;
  // Full E.164 — the clinic's own office number (the owner sees it in /account);
  // not a third-party/patient number, so it is shown unmasked to the operator.
  phoneE164: string | null;
  role: string;
  isActive: boolean;
  sidTail: string | null;
  // Full Twilio IncomingPhoneNumber SID (not a secret) so the operator can find
  // the number in the Twilio console.
  twilioSid: string | null;
  createdAt: string;
  updatedAt: string;
  // self-service-numbers snapshot
  source: string;
  billingClass: string;
  monthlyUnitAmountCents: number;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
};

export type AdminPurchaseAttempt = {
  id: string;
  requestedPhoneNumber: string;
  source: string;
  slotClass: string;
  status: string;
  // Twilio SID is always shown to the operator for reconciliation_required.
  twilioSid: string | null;
  errorCode: string | null;
  createdAt: string;
};

export type AdminClinicDetail = {
  id: string;
  name: string;
  slug: string | null;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  // business identity. The platform admin is the operator who reviews/submits the
  // A2P registration packet, so the clinic's own business identity fields (which
  // the owner already sees in /account) are shown in full here. einProvided /
  // mainPhoneMasked are kept for compact summaries; full values are also exposed.
  legalBusinessName: string | null;
  businessType: string | null;
  einProvided: boolean;
  einTaxId: string | null;
  mainPhoneMasked: string | null;
  mainPhone: string | null;
  street: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string;
  timezone: string | null;
  preferredAreaCode: string | null;
  website: string | null;
  businessInfoCompleted: boolean;
  // owner / members
  ownerContactEmail: string | null;
  ownerContactName: string | null;
  ownerContactPhone: string | null;
  testPatientPhone: string | null;
  members: AdminClinicMember[];
  // billing readiness. Stripe ids are object references (e.g. cus_…/sub_…), not
  // secrets; shown to the operator. Presence flags kept for compact summaries.
  billingStatus: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  stripeCustomerPresent: boolean;
  stripeSubscriptionPresent: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  // Real saved payment-method presence + safe metadata (Stripe sandbox/test).
  // Payment-method presence is keyed off stripePaymentMethodId, NOT the customer
  // id. The payment-method id is an object reference, not a secret.
  stripePaymentMethodPresent: boolean;
  stripePaymentMethodId: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paymentMethodExpMonth: number | null;
  paymentMethodExpYear: number | null;
  paymentMethodAddedAt: string | null;
  // number-purchase controls + counts (self-service-numbers)
  phoneNumberPurchasesEnabled: boolean;
  phoneNumberLimit: number;
  phoneNumberPurchaseSuspendedReason: string | null;
  heldNumberCount: number;
  activeNumberCount: number;
  additionalBilledQuantity: number;
  paidPlanStartedAt: string | null;
  recentPurchaseAttempts: AdminPurchaseAttempt[];
  // phone
  localNumberStatus: string;
  assignedPhoneMasked: string | null;
  hasAssignedNumber: boolean;
  phoneNumbers: AdminClinicPhoneNumber[];
  // All open owner-requested numbers (owner preference + pricing/consent snapshot
  // for admin review). NOT assigned/active numbers — purchase + assignment stay
  // admin-controlled, and a pending request is never charged.
  requestedNumbers: {
    id: string;
    phoneNumber: string;
    friendlyName: string | null;
    locality: string | null;
    region: string | null;
    status: string;
    createdAt: string;
    requestedByEmail: string | null;
    billingClass: string;
    monthlyUnitAmountCents: number;
    currency: string;
    billingConsentTextVersion: string | null;
    billingConsentText: string | null;
    billingConsentAuthorizedAt: string | null;
    billingConsentAuthorizedByEmail: string | null;
  }[];
  // sms approval / a2p. Representative details (which the owner sees in /account)
  // are the A2P submission packet, shown in full to the operator.
  smsStatus: string;
  a2pInfoCompleted: boolean;
  a2pAuthorized: boolean;
  a2pRepProvided: boolean;
  a2pRepFirstName: string | null;
  a2pRepLastName: string | null;
  a2pRepBusinessTitle: string | null;
  a2pRepEmail: string | null;
  a2pRepPhone: string | null;
  // lifecycle
  setupStatus: string;
  // internal-only operator fields
  adminInternalNote: string | null;
  adminProvisioningStatus: string | null;
  adminProvisioningNote: string | null;
  // diagnostics
  optOutCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCallEvent = {
  id: string;
  fromMasked: string | null;
  toMasked: string | null;
  callStatus: string | null;
  direction: string | null;
  isMissed: boolean | null;
  sidTail: string | null;
  occurredAt: string;
};

export type AdminMessageEvent = {
  id: string;
  direction: string;
  status: string | null;
  detectedKeyword: string | null;
  errored: boolean;
  sidTail: string | null;
  createdAt: string;
};

export type AdminClinicEvents = {
  calls: AdminCallEvent[];
  messages: AdminMessageEvent[];
};

export type AuditEventInput = {
  adminUserId: string | null;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  clinicId?: string | null;
  beforeState?: Record<string, string | number | boolean | null> | null;
  afterState?: Record<string, string | number | boolean | null> | null;
  metadata?: Record<string, string | number | boolean | null> | null;
};

export type AuditEventRow = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  clinic_id: string | null;
  before_state: unknown;
  after_state: unknown;
  metadata: unknown;
  created_at: Date;
};

export type AuditListFilters = {
  adminEmail?: string | null;
  clinicId?: string | null;
  action?: string | null;
};

// ---- pure redaction helpers ----

export function maskPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••• ••• ${digits.slice(-4)}`;
}

export function tailSid(sid: string | null | undefined, n = 6): string | null {
  if (!sid) return null;
  return `…${sid.slice(-n)}`;
}
