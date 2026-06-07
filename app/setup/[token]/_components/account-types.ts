// Shared types for the customer-facing account setup dashboard. No runtime code,
// so both the server page and the client components can import these freely.

export type BusinessProfileFields = {
  name: string;
  mainPhone: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  website: string;
};

export type SmsApprovalFields = {
  legalBusinessName: string;
  einTaxId: string;
  businessType: string;
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  authorized: boolean;
};

export type LocalNumberStatus = "preparing" | "reserved" | "assigned";
export type SmsStatus = "preparing" | "waiting_for_approval" | "active";

// Safe, non-secret saved payment-method summary surfaced to the owner UI. No raw
// card data — Stripe holds the sensitive values.
export type PaymentMethodSummary = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  // ISO timestamp when the method was first saved, or null.
  addedAt: string | null;
};

// Result of returning from Stripe-hosted setup, read from the ?payment_method_setup
// query param. Null when the page was not reached via a Stripe return.
export type PaymentMethodSetupResult = "success" | "cancelled" | null;

// An assigned business number. Multiple may exist; none is ever hidden/replaced
// because another number is purchased. Suspended numbers stay listed (isActive
// false) and still count toward the limit + billing quantity.
export type AssignedBusinessNumberSummary = {
  id: string;
  phoneNumber: string;
  // 'toll_free' (833/844/… — first is included) or 'local' (paid add-on, A2P 10DLC).
  numberType: "toll_free" | "local";
  role: string;
  isActive: boolean;
  billingClass: "legacy" | "included" | "additional";
  createdAt: string | null;
};

// Owner-safe number-purchase entitlement (computed server-side from live state).
// Drives the Phone numbers panel CTAs and gating. The client never decides any
// of this — it only renders it.
export type OwnerNumberEntitlement = {
  heldNumberCount: number;
  activeNumberCount: number;
  numberLimit: number;
  additionalBilledQuantity: number;
  purchasesEnabled: boolean;
  nextSlotClass: "included" | "additional";
  isTrialing: boolean;
  trialEnded: boolean;
  hasActivePaidSubscription: boolean;
  localBillingConfigured: boolean;
  canPurchaseNext: boolean;
  // null when purchasable; otherwise a stable machine-readable block reason.
  blockReason: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidPlanStartedAt: string | null;
  billingStatus: string;
};

// An owner-requested number (preference + pricing/consent snapshot awaiting admin
// review). This is NOT an assigned/active number — assignment stays
// admin-controlled, and a pending request is never charged.
export type RequestedNumberSummary = {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  locality: string | null;
  region: string | null;
  // 'pending' | 'reviewed' | 'fulfilled' | 'rejected' | 'cancelled'
  status: string;
  createdAt: string | null;
  // Billing snapshot recorded at request time (revalidated at activation later).
  billingClass: "included" | "additional";
  monthlyUnitAmountCents: number;
  currency: string;
  billingConsentAuthorizedAt: string | null;
};

export type BusinessProfileData = {
  // Legacy setup token for token-scoped API routes. Null when authenticated
  // session routes are used (normal /login -> /account flow).
  token: string | null;
  // Read-only email the setup link was sent to.
  loginEmail: string;
  // Absolute base URL for the public /business/{slug} pages.
  publicBaseUrl: string;
  slug: string | null;
  // Section to open on load (e.g. "billing" after returning from Stripe). When
  // null/unknown the default section (Phone number) opens.
  initialSection?: string | null;
  // Outcome of a returning Stripe payment-method setup redirect, if any.
  paymentMethodSetup?: PaymentMethodSetupResult;
  // Legacy outcome of a returning Stripe paid-plan redirect. Current paid-plan
  // start stays in-app and uses the saved payment method instead.
  paidPlanResult?: "success" | "cancelled" | null;
  businessProfile: BusinessProfileFields & { completed: boolean };
  smsApproval: SmsApprovalFields & { completed: boolean };
  number: {
    localNumberStatus: LocalNumberStatus;
    smsStatus: SmsStatus;
    // All assigned business numbers (may be empty). Never collapsed to one.
    assignedNumbers: AssignedBusinessNumberSummary[];
    // Initial local-number search values come from the saved office profile.
    // Editing them in the Phone number search does not update the profile.
    areaCode: string | null;
    postalCode: string | null;
    // Server-computed purchase entitlement (gating + CTA selection).
    entitlement: OwnerNumberEntitlement;
  };
  billing: {
    // True only when a real payment method is saved (stripe_payment_method_id
    // present). NOT derived from the Stripe customer id or billing_status.
    hasPaymentMethod: boolean;
    // Safe saved-method summary, or null when none is on file.
    paymentMethod: PaymentMethodSummary | null;
    // Days left in the 21-day trial, counted from clinics.trial_ends_at. 0 ended.
    trialDaysRemaining: number;
    trialEnded: boolean;
    isTrialing: boolean;
    // True only when a webhook-confirmed active paid subscription exists.
    paidPlanActive: boolean;
    billingStatus: string;
  };
  security: {
    passwordEnabled: boolean;
  };
  teamAccess: {
    // Real active members from auth + membership data.
    members: {
      email: string;
      role: "owner" | "front_desk" | "admin";
      status: "active";
    }[];
  };
};
