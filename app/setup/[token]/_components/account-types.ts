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

// Latest owner-requested number (preference awaiting admin review). This is NOT
// an assigned/active number — assignment stays admin-controlled.
export type RequestedNumberSummary = {
  phoneNumber: string;
  friendlyName: string | null;
  locality: string | null;
  region: string | null;
  // 'pending' | 'reviewed' | 'fulfilled' | 'rejected' | 'cancelled'
  status: string;
  createdAt: string | null;
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
  businessProfile: BusinessProfileFields & { completed: boolean };
  smsApproval: SmsApprovalFields & { completed: boolean };
  number: {
    localNumberStatus: LocalNumberStatus;
    smsStatus: SmsStatus;
    // The assigned office number in E.164 when one exists, else null.
    assignedPhone: string | null;
    // Initial local-number search values come from the saved office profile.
    // Editing them in the Phone number search does not update the profile.
    areaCode: string | null;
    postalCode: string | null;
    // Latest owner-requested number awaiting admin review, or null.
    requestedNumber: RequestedNumberSummary | null;
  };
  billing: {
    // True only when a real payment method is saved (stripe_payment_method_id
    // present). NOT derived from the Stripe customer id or billing_status.
    hasPaymentMethod: boolean;
    // Safe saved-method summary, or null when none is on file.
    paymentMethod: PaymentMethodSummary | null;
    // Days left in the 21-day trial, counted from setup creation. 0 when ended.
    trialDaysRemaining: number;
    trialEnded: boolean;
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
