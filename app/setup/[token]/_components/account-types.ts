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

export type BusinessProfileData = {
  // Legacy setup token for token-scoped API routes. Null when authenticated
  // session routes are used (normal /login -> /account flow).
  token: string | null;
  // Read-only email the setup link was sent to.
  loginEmail: string;
  // Absolute base URL for the public /business/{slug} pages.
  publicBaseUrl: string;
  slug: string | null;
  businessProfile: BusinessProfileFields & { completed: boolean };
  smsApproval: SmsApprovalFields & { completed: boolean };
  number: {
    localNumberStatus: LocalNumberStatus;
    smsStatus: SmsStatus;
    // The assigned office number in E.164 when one exists, else null.
    assignedPhone: string | null;
  };
  billing: {
    // True once a payment method is on file (derived server-side from the
    // Stripe customer / billing status). No raw card data is ever stored.
    hasPaymentMethod: boolean;
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
