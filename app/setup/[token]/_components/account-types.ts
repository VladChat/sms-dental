// Shared types for the customer-facing account setup page. No runtime code, so
// both the server page and the client components can import these freely.

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
  token: string;
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
  };
  billing: {
    billingStatus: string;
    trialDays: number;
  };
};
