// Single source of truth for the EXACT Twilio A2P provider payload.
//
// Minimum-information rule: only fields REQUIRED (or conditionally required) by
// the Twilio resource being created are included here. Optional provider fields
// are omitted by default. Internal diagnostics (readiness, SIDs, statuses, sync
// timestamps, support/compliance URLs) are NOT here and are NOT submitted.
//
// Both the real submission helper (lib/twilio/a2p-submission.ts) and the admin
// review-package builder import these builders, so "what is shown" exactly equals
// "what is submitted". The ONLY difference is the EIN value: the helper passes the
// raw EIN to Twilio; the review view passes a masked value. The full EIN is never
// placed in the display view, logs, or persisted state.
//
// Client-safe: no server imports.
import type {
  A2pCampaignContent,
  A2pPayloadResource,
  A2pProviderPayloadView,
} from "./types";

// Whether a stored website is a disallowed placeholder/platform/owner domain that
// must NOT be submitted as this clinic's own A2P business website. Matches the
// host exactly or as a subdomain (e.g. "allyexp.com" matches "www.allyexp.com").
export function isDisallowedClinicWebsite(
  rawUrl: string | null | undefined,
  disallowedHosts: string[],
): boolean {
  const v = (rawUrl ?? "").trim();
  if (!v) return false;
  let host: string;
  try {
    host = new URL(v).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  return disallowedHosts.some((bad) => host === bad || host.endsWith(`.${bad}`));
}

// Map the stored A2P business_type enum to a Trust Hub legal-structure string.
// Account/policy-specific — verify acceptable values against your Twilio account.
export function mapBusinessType(value: string | null, fallback: string): string {
  switch ((value ?? "").trim()) {
    case "PRIVATE_PROFIT": return "Private Company";
    case "PUBLIC_PROFIT": return "Public Company";
    case "NON_PROFIT": return "Non-profit Corporation";
    case "SOLE_PROPRIETOR": return "Sole Proprietorship";
    case "GOVERNMENT": return "Government";
    default: return fallback;
  }
}

// Required attributes for the customer_profile_business_information EndUser.
// `businessRegistrationNumber` is the EIN (raw for submit, masked for display).
export function businessInfoAttributes(i: {
  businessName: string;
  businessType: string;
  industry: string;
  registrationIdentifier: string;
  businessRegistrationNumber: string;
  regionsOfOperation: string;
  identity: string;
  websiteUrl: string;
}): Record<string, string> {
  return {
    business_name: i.businessName,
    business_type: i.businessType,
    business_industry: i.industry,
    business_registration_identifier: i.registrationIdentifier,
    business_registration_number: i.businessRegistrationNumber,
    business_regions_of_operation: i.regionsOfOperation,
    business_identity: i.identity,
    website_url: i.websiteUrl,
  };
}

// Required attributes for the authorized_representative_1 EndUser.
export function representativeAttributes(i: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobPosition: string;
  businessTitle: string;
}): Record<string, string> {
  return {
    first_name: i.firstName,
    last_name: i.lastName,
    email: i.email,
    phone_number: i.phone,
    job_position: i.jobPosition,
    business_title: i.businessTitle,
  };
}

// Required attribute for the us_a2p_messaging_profile_information EndUser (private
// company). stock_exchange/stock_ticker are only added for public companies and
// are intentionally omitted here.
export function a2pProfileAttributes(i: { companyType: string }): Record<string, string> {
  return { company_type: i.companyType };
}

export type A2pAddressParams = {
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  streetSecondary?: string;
};

// Required Address fields. streetSecondary is included only when present
// (conditionally required); optional flags (emergencyEnabled, autoCorrectAddress)
// are omitted.
export function addressParams(i: {
  customerName: string;
  street: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
}): A2pAddressParams {
  const p: A2pAddressParams = {
    customerName: i.customerName,
    street: i.street,
    city: i.city,
    region: i.region,
    postalCode: i.postalCode,
    isoCountry: i.isoCountry,
  };
  const line2 = (i.addressLine2 ?? "").trim();
  if (line2) p.streetSecondary = line2;
  return p;
}

const ATTR_LABELS: Record<string, string> = {
  business_name: "Business name",
  business_type: "Business type",
  business_industry: "Industry",
  business_registration_identifier: "Registration ID type",
  business_registration_number: "Registration number (EIN)",
  business_regions_of_operation: "Regions of operation",
  business_identity: "Business identity",
  website_url: "Website",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone_number: "Phone",
  job_position: "Job position",
  business_title: "Business title",
  company_type: "Company type",
};

function fieldsFromAttrs(attrs: Record<string, string>): A2pPayloadResource["fields"] {
  return Object.entries(attrs).map(([k, v]) => ({ label: ATTR_LABELS[k] ?? k, value: v }));
}

export type ProviderPayloadViewInput = {
  clinicName: string;
  // business (display): masked EIN only
  legalBusinessName: string;
  businessTypeMapped: string;
  industry: string;
  registrationIdentifier: string;
  einMaskedValue: string; // e.g. "Provided ···· 1234"
  regionsOfOperation: string;
  identity: string;
  websiteUrl: string;
  // representative
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  repJobPosition: string;
  repBusinessTitle: string;
  // a2p profile
  companyType: string;
  // address
  address: A2pAddressParams;
  // bundles / brand / campaign / numbers
  customerProfilePolicySid: string;
  a2pTrustProductPolicySid: string;
  brandType: string;
  campaign: A2pCampaignContent;
  numbers: Array<{ phoneNumber: string; twilioPhoneNumberSid: string | null }>;
};

// Build the display-only "what will be submitted to Twilio" view. EIN is masked.
// Field SETS are derived from the same builders the helper submits with.
export function buildProviderPayloadView(i: ProviderPayloadViewInput): A2pProviderPayloadView {
  const businessAttrs = businessInfoAttributes({
    businessName: i.legalBusinessName,
    businessType: i.businessTypeMapped,
    industry: i.industry,
    registrationIdentifier: i.registrationIdentifier,
    businessRegistrationNumber: i.einMaskedValue,
    regionsOfOperation: i.regionsOfOperation,
    identity: i.identity,
    websiteUrl: i.websiteUrl,
  });
  const repAttrs = representativeAttributes({
    firstName: i.repFirstName,
    lastName: i.repLastName,
    email: i.repEmail,
    phone: i.repPhone,
    jobPosition: i.repJobPosition,
    businessTitle: i.repBusinessTitle,
  });
  const a2pAttrs = a2pProfileAttributes({ companyType: i.companyType });

  const addrFields: A2pPayloadResource["fields"] = [
    { label: "Customer name", value: i.address.customerName },
    { label: "Street", value: i.address.street },
    ...(i.address.streetSecondary ? [{ label: "Street 2", value: i.address.streetSecondary }] : []),
    { label: "City", value: i.address.city },
    { label: "Region", value: i.address.region },
    { label: "Postal code", value: i.address.postalCode },
    { label: "Country", value: i.address.isoCountry },
  ];

  const resources: A2pPayloadResource[] = [
    { step: "Business information (EndUser)", fields: fieldsFromAttrs(businessAttrs) },
    { step: "Authorized representative (EndUser)", fields: fieldsFromAttrs(repAttrs) },
    { step: "A2P messaging profile (EndUser)", fields: fieldsFromAttrs(a2pAttrs) },
    { step: "Business address", fields: addrFields },
    {
      step: "Secondary Customer Profile",
      fields: [
        { label: "Friendly name", value: `${i.clinicName} A2P customer profile` },
        { label: "Policy SID", value: i.customerProfilePolicySid },
      ],
    },
    {
      step: "A2P Trust Product",
      fields: [
        { label: "Friendly name", value: `${i.clinicName} A2P trust product` },
        { label: "Policy SID", value: i.a2pTrustProductPolicySid },
      ],
    },
    { step: "Brand Registration", fields: [{ label: "Brand type", value: i.brandType }] },
    {
      step: "A2P Campaign",
      fields: [
        { label: "Use case", value: i.campaign.usecase },
        { label: "Embedded links", value: i.campaign.hasEmbeddedLinks ? "Yes" : "No" },
        { label: "Embedded phone", value: i.campaign.hasEmbeddedPhone ? "Yes" : "No" },
        { label: "Description", value: i.campaign.description },
        { label: "Opt-in / message flow", value: i.campaign.messageFlow },
        ...i.campaign.sampleMessages.map((m, idx) => ({ label: `Sample message ${idx + 1}`, value: m })),
      ],
    },
    {
      step: "Messaging Service senders",
      fields: i.numbers.map((n) => ({
        label: n.phoneNumber,
        value: n.twilioPhoneNumberSid ?? "(missing PN SID)",
      })),
    },
  ];

  return { resources };
}
