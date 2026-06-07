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
import { mapBusinessTypeForTwilio } from "./validation";

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

// Map the stored A2P business_type value to the exact Trust Hub legal-structure
// string expected by Twilio. Returns null when the local value is too generic or
// unsupported to submit safely.
export function mapBusinessType(value: string | null): string | null {
  return mapBusinessTypeForTwilio(value ?? "");
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

function boolLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

function generatedOrSid(value: string | null | undefined): string {
  return (value ?? "").trim() || "Generated during this submission";
}

function fieldsFromValues(
  values: Record<string, string | boolean | null | undefined>,
): A2pPayloadResource["fields"] {
  return Object.entries(values).flatMap(([label, value]) => {
    if (value == null) return [];
    return [{
      label,
      value: typeof value === "boolean" ? boolLabel(value) : value,
    }];
  });
}

export function buildBusinessEndUserPayload(i: {
  clinicName: string;
  businessName: string;
  businessType: string;
  industry: string;
  registrationIdentifier: string;
  businessRegistrationNumber: string;
  regionsOfOperation: string;
  identity: string;
  websiteUrl: string;
}): {
  friendlyName: string;
  type: string;
  attributes: Record<string, string>;
} {
  return {
    friendlyName: `${i.clinicName} business info`,
    type: "customer_profile_business_information",
    attributes: businessInfoAttributes({
      businessName: i.businessName,
      businessType: i.businessType,
      industry: i.industry,
      registrationIdentifier: i.registrationIdentifier,
      businessRegistrationNumber: i.businessRegistrationNumber,
      regionsOfOperation: i.regionsOfOperation,
      identity: i.identity,
      websiteUrl: i.websiteUrl,
    }),
  };
}

export function buildRepresentativeEndUserPayload(i: {
  clinicName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobPosition: string;
  businessTitle: string;
}): {
  friendlyName: string;
  type: string;
  attributes: Record<string, string>;
} {
  return {
    friendlyName: `${i.clinicName} authorized rep`,
    type: "authorized_representative_1",
    attributes: representativeAttributes({
      firstName: i.firstName,
      lastName: i.lastName,
      email: i.email,
      phone: i.phone,
      jobPosition: i.jobPosition,
      businessTitle: i.businessTitle,
    }),
  };
}

export function buildA2pMessagingProfileEndUserPayload(i: {
  clinicName: string;
  companyType: string;
}): {
  friendlyName: string;
  type: string;
  attributes: Record<string, string>;
} {
  return {
    friendlyName: `${i.clinicName} a2p messaging profile`,
    type: "us_a2p_messaging_profile_information",
    attributes: a2pProfileAttributes({ companyType: i.companyType }),
  };
}

export function buildSupportingDocumentPayload(i: {
  clinicName: string;
  addressSid: string;
}): {
  friendlyName: string;
  type: string;
  attributes: Record<string, string>;
} {
  return {
    friendlyName: `${i.clinicName} address proof`,
    type: "customer_profile_address",
    attributes: { address_sids: i.addressSid },
  };
}

export function buildSecondaryCustomerProfileCreatePayload(i: {
  clinicName: string;
  notificationEmail: string;
  policySid: string;
}): {
  friendlyName: string;
  email: string;
  policySid: string;
} {
  return {
    friendlyName: `${i.clinicName} A2P customer profile`,
    email: i.notificationEmail,
    policySid: i.policySid,
  };
}

export function buildCustomerProfileEvaluationPayload(i: {
  policySid: string;
}): { policySid: string } {
  return { policySid: i.policySid };
}

export function buildA2pTrustProductCreatePayload(i: {
  clinicName: string;
  notificationEmail: string;
  policySid: string;
}): {
  friendlyName: string;
  email: string;
  policySid: string;
} {
  return {
    friendlyName: `${i.clinicName} A2P trust product`,
    email: i.notificationEmail,
    policySid: i.policySid,
  };
}

export function buildTrustProductEvaluationPayload(i: {
  policySid: string;
}): { policySid: string } {
  return { policySid: i.policySid };
}

export function buildBrandRegistrationPayload(i: {
  customerProfileSid: string;
  trustProductSid: string;
}): {
  customerProfileBundleSid: string;
  a2PProfileBundleSid: string;
} {
  return {
    customerProfileBundleSid: i.customerProfileSid,
    a2PProfileBundleSid: i.trustProductSid,
  };
}

export function buildCampaignCreatePayload(i: {
  brandRegistrationSid: string;
  campaign: A2pCampaignContent;
}): {
  brandRegistrationSid: string;
  description: string;
  messageFlow: string;
  messageSamples: string[];
  usAppToPersonUsecase: string;
  hasEmbeddedLinks: boolean;
  hasEmbeddedPhone: boolean;
} {
  return {
    brandRegistrationSid: i.brandRegistrationSid,
    description: i.campaign.description,
    messageFlow: i.campaign.messageFlow,
    messageSamples: i.campaign.sampleMessages,
    usAppToPersonUsecase: i.campaign.usecase,
    hasEmbeddedLinks: i.campaign.hasEmbeddedLinks,
    hasEmbeddedPhone: i.campaign.hasEmbeddedPhone,
  };
}

export function buildMessagingServiceSenderPayload(i: {
  phoneNumberSid: string;
}): { phoneNumberSid: string } {
  return { phoneNumberSid: i.phoneNumberSid };
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
  notificationEmail: string;
  primaryCustomerProfileSid: string;
  messagingServiceSid: string;
  customerProfilePolicySid: string;
  a2pTrustProductPolicySid: string;
  campaign: A2pCampaignContent;
  existingSids: {
    businessEndUserSid: string | null;
    repEndUserSid: string | null;
    addressSid: string | null;
    supportingDocumentSid: string | null;
    customerProfileSid: string | null;
    a2pProfileEndUserSid: string | null;
    trustProductSid: string | null;
    brandRegistrationSid: string | null;
  };
  numbers: Array<{ phoneNumber: string; twilioPhoneNumberSid: string | null }>;
};

// Build the display-only "what will be submitted to Twilio" view. EIN is masked.
// Field SETS are derived from the same builders the helper submits with.
export function buildProviderPayloadView(i: ProviderPayloadViewInput): A2pProviderPayloadView {
  const businessPayload = buildBusinessEndUserPayload({
    clinicName: i.clinicName,
    businessName: i.legalBusinessName,
    businessType: i.businessTypeMapped,
    industry: i.industry,
    registrationIdentifier: i.registrationIdentifier,
    businessRegistrationNumber: i.einMaskedValue,
    regionsOfOperation: i.regionsOfOperation,
    identity: i.identity,
    websiteUrl: i.websiteUrl,
  });
  const representativePayload = buildRepresentativeEndUserPayload({
    clinicName: i.clinicName,
    firstName: i.repFirstName,
    lastName: i.repLastName,
    email: i.repEmail,
    phone: i.repPhone,
    jobPosition: i.repJobPosition,
    businessTitle: i.repBusinessTitle,
  });
  const a2pProfilePayload = buildA2pMessagingProfileEndUserPayload({
    clinicName: i.clinicName,
    companyType: i.companyType,
  });
  const secondaryProfileCreate = buildSecondaryCustomerProfileCreatePayload({
    clinicName: i.clinicName,
    notificationEmail: i.notificationEmail,
    policySid: i.customerProfilePolicySid,
  });
  const trustProductCreate = buildA2pTrustProductCreatePayload({
    clinicName: i.clinicName,
    notificationEmail: i.notificationEmail,
    policySid: i.a2pTrustProductPolicySid,
  });
  const brandPayload = buildBrandRegistrationPayload({
    customerProfileSid: generatedOrSid(i.existingSids.customerProfileSid),
    trustProductSid: generatedOrSid(i.existingSids.trustProductSid),
  });
  const campaignPayload = buildCampaignCreatePayload({
    brandRegistrationSid: generatedOrSid(i.existingSids.brandRegistrationSid),
    campaign: i.campaign,
  });

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
    {
      step: "Business information (EndUser)",
      fields: [
        ...fieldsFromValues({
          "Friendly name": businessPayload.friendlyName,
          "Resource type": businessPayload.type,
        }),
        ...fieldsFromAttrs(businessPayload.attributes),
      ],
    },
    {
      step: "Authorized representative (EndUser)",
      fields: [
        ...fieldsFromValues({
          "Friendly name": representativePayload.friendlyName,
          "Resource type": representativePayload.type,
        }),
        ...fieldsFromAttrs(representativePayload.attributes),
      ],
    },
    {
      step: "A2P messaging profile (EndUser)",
      fields: [
        ...fieldsFromValues({
          "Friendly name": a2pProfilePayload.friendlyName,
          "Resource type": a2pProfilePayload.type,
        }),
        ...fieldsFromAttrs(a2pProfilePayload.attributes),
      ],
    },
    { step: "Business address", fields: addrFields },
    {
      step: "Secondary Customer Profile",
      fields: fieldsFromValues({
        "Friendly name": secondaryProfileCreate.friendlyName,
        "Notification email": secondaryProfileCreate.email,
        "Policy SID": secondaryProfileCreate.policySid,
        "Business info EndUser SID": generatedOrSid(i.existingSids.businessEndUserSid),
        "Authorized rep EndUser SID": generatedOrSid(i.existingSids.repEndUserSid),
        "Address supporting doc SID": generatedOrSid(i.existingSids.supportingDocumentSid),
        "Primary Customer Profile SID": i.primaryCustomerProfileSid,
        "Evaluation policy SID": buildCustomerProfileEvaluationPayload({
          policySid: i.customerProfilePolicySid,
        }).policySid,
        "Submit status": "pending-review",
      }),
    },
    {
      step: "A2P Trust Product",
      fields: fieldsFromValues({
        "Friendly name": trustProductCreate.friendlyName,
        "Notification email": trustProductCreate.email,
        "Policy SID": trustProductCreate.policySid,
        "A2P profile EndUser SID": generatedOrSid(i.existingSids.a2pProfileEndUserSid),
        "Secondary Customer Profile SID": generatedOrSid(i.existingSids.customerProfileSid),
        "Evaluation policy SID": buildTrustProductEvaluationPayload({
          policySid: i.a2pTrustProductPolicySid,
        }).policySid,
        "Submit status": "pending-review",
      }),
    },
    {
      step: "Brand Registration",
      fields: fieldsFromValues({
        "Secondary Customer Profile SID": brandPayload.customerProfileBundleSid,
        "A2P Trust Product SID": brandPayload.a2PProfileBundleSid,
      }),
    },
    {
      step: "A2P Campaign",
      fields: [
        ...fieldsFromValues({
          "Messaging Service SID": i.messagingServiceSid,
          "Brand Registration SID": campaignPayload.brandRegistrationSid,
          "Use case": campaignPayload.usAppToPersonUsecase,
          "Embedded links": campaignPayload.hasEmbeddedLinks,
          "Embedded phone": campaignPayload.hasEmbeddedPhone,
          Description: campaignPayload.description,
          "Opt-in / message flow": campaignPayload.messageFlow,
        }),
        ...campaignPayload.messageSamples.map((m, idx) => ({
          label: `Sample message ${idx + 1}`,
          value: m,
        })),
      ],
    },
    {
      step: "Messaging Service senders",
      fields: [
        ...fieldsFromValues({ "Messaging Service SID": i.messagingServiceSid }),
        ...i.numbers.map((n) => {
          const senderPayload = buildMessagingServiceSenderPayload({
            phoneNumberSid: n.twilioPhoneNumberSid ?? "(missing PN SID)",
          });
          return {
            label: n.phoneNumber,
            value: senderPayload.phoneNumberSid,
          };
        }),
      ],
    },
  ];

  return { resources };
}
