import { normalizePhone } from "../phone/normalize";
import type { A2pCampaignContent, A2pPayloadResource, A2pReviewPackage } from "./types";

export type A2pValidationSeverity = "error" | "warning" | "info";

export type A2pValidationResult = {
  field: string;
  code: string;
  severity: A2pValidationSeverity;
  message: string;
  operatorMessage?: string;
};

const SUPPORTED_BUSINESS_TYPE_MAP = {
  LIMITED_LIABILITY_COMPANY: {
    label: "Limited liability company (LLC)",
    twilioValue: "Limited Liability Corporation",
  },
  CORPORATION: {
    label: "Corporation",
    twilioValue: "Corporation",
  },
  NON_PROFIT_CORPORATION: {
    label: "Non-profit corporation",
    twilioValue: "Non-profit Corporation",
  },
  PARTNERSHIP: {
    label: "Partnership",
    twilioValue: "Partnership",
  },
  CO_OPERATIVE: {
    label: "Co-operative",
    twilioValue: "Co-operative",
  },
  SOLE_PROPRIETORSHIP: {
    label: "Sole proprietorship",
    twilioValue: "Sole Proprietorship",
  },
} as const;

const LEGACY_BUSINESS_TYPE_LABELS = {
  PRIVATE_PROFIT: "Private company (legacy - choose exact structure)",
  PUBLIC_PROFIT: "Public company (legacy - choose exact structure)",
  NON_PROFIT: "Non-profit (legacy)",
  SOLE_PROPRIETOR: "Sole proprietor (legacy)",
  GOVERNMENT: "Government (not supported for this A2P flow)",
} as const;

export const BUSINESS_TYPES = [
  "LIMITED_LIABILITY_COMPANY",
  "CORPORATION",
  "NON_PROFIT_CORPORATION",
  "PARTNERSHIP",
  "CO_OPERATIVE",
  "SOLE_PROPRIETORSHIP",
  "PRIVATE_PROFIT",
  "PUBLIC_PROFIT",
  "NON_PROFIT",
  "SOLE_PROPRIETOR",
  "GOVERNMENT",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  LIMITED_LIABILITY_COMPANY: SUPPORTED_BUSINESS_TYPE_MAP.LIMITED_LIABILITY_COMPANY.label,
  CORPORATION: SUPPORTED_BUSINESS_TYPE_MAP.CORPORATION.label,
  NON_PROFIT_CORPORATION: SUPPORTED_BUSINESS_TYPE_MAP.NON_PROFIT_CORPORATION.label,
  PARTNERSHIP: SUPPORTED_BUSINESS_TYPE_MAP.PARTNERSHIP.label,
  CO_OPERATIVE: SUPPORTED_BUSINESS_TYPE_MAP.CO_OPERATIVE.label,
  SOLE_PROPRIETORSHIP: SUPPORTED_BUSINESS_TYPE_MAP.SOLE_PROPRIETORSHIP.label,
  PRIVATE_PROFIT: LEGACY_BUSINESS_TYPE_LABELS.PRIVATE_PROFIT,
  PUBLIC_PROFIT: LEGACY_BUSINESS_TYPE_LABELS.PUBLIC_PROFIT,
  NON_PROFIT: LEGACY_BUSINESS_TYPE_LABELS.NON_PROFIT,
  SOLE_PROPRIETOR: LEGACY_BUSINESS_TYPE_LABELS.SOLE_PROPRIETOR,
  GOVERNMENT: LEGACY_BUSINESS_TYPE_LABELS.GOVERNMENT,
};

const SUPPORTED_JOB_POSITIONS = new Set([
  "Director",
  "GM",
  "VP",
  "CEO",
  "CFO",
  "General Counsel",
  "Other",
]);

const INVALID_NAME_PLACEHOLDERS = new Set([
  "test",
  "demo",
  "sample",
  "clinic",
  "test clinic",
  "business",
  "company",
  "na",
  "n/a",
  "none",
  "owner name",
]);

const INVALID_TITLE_PLACEHOLDERS = new Set([
  "test",
  "demo",
  "sample",
  "title",
  "job title",
  "owner name",
  "na",
  "n/a",
  "none",
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "example.com",
  "mailinator.com",
  "tempmail.com",
  "test.com",
]);

const OBVIOUS_FAKE_EINS = new Set([
  "000000000",
  "111111111",
  "222222222",
  "333333333",
  "444444444",
  "555555555",
  "666666666",
  "777777777",
  "888888888",
  "999999999",
  "123456789",
  "987654321",
]);

const LINK_RE = /\bhttps?:\/\/|www\./i;
const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
const SPAMMY_LANGUAGE_RE = /\b(urgent|limited time|act now|guarantee|guaranteed|discount|deal)\b/i;
const MEDICAL_PROMISE_RE = /\b(cure|guarantee results|fix your pain|eliminate pain|medical breakthrough)\b/i;

export function normalizeEin(value: string): string {
  return (value ?? "").trim().replace(/[\s-]/g, "");
}

export function formatEinForDisplay(value: string): string {
  const digits = normalizeEin(value).replace(/\D/g, "");
  if (digits.length !== 9) return (value ?? "").trim();
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function formatEinForTwilio(value: string): string {
  const digits = normalizeEin(value).replace(/\D/g, "");
  if (digits.length !== 9) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function maskEin(value: string): string {
  const digits = normalizeEin(value).replace(/\D/g, "");
  if (!digits) return "Missing";
  const tail = digits.slice(-4).padStart(4, "•");
  return `Provided ···· ${tail}`;
}

export function validateEin(value: string): A2pValidationResult | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return {
      field: "business_registration_number",
      code: "MISSING_EIN",
      severity: "error",
      message: "Enter a valid 9-digit EIN, for example 12-3456789. It must match your legal business name.",
      operatorMessage:
        "Cannot submit: EIN is missing. Ask the clinic owner to enter a valid 9-digit EIN before A2P submission.",
    };
  }
  if (/[A-Za-z]/.test(trimmed)) {
    return invalidEinResult();
  }
  const digits = normalizeEin(trimmed);
  if (!/^\d{9}$/.test(digits) || OBVIOUS_FAKE_EINS.has(digits)) {
    return invalidEinResult();
  }
  return null;
}

export function validateLegalBusinessName(value: string): A2pValidationResult | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 2 || INVALID_NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return {
      field: "legal_business_name",
      code: "INVALID_LEGAL_BUSINESS_NAME",
      severity: "error",
      message: "Enter the exact legal business name for the clinic/business.",
    };
  }
  return null;
}

export function validateRepresentativeName(
  value: string,
  fieldName: string,
): A2pValidationResult | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 2 || /\d/.test(trimmed) || INVALID_NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return {
      field: fieldName,
      code: "INVALID_REPRESENTATIVE_NAME",
      severity: "error",
      message: `Enter a valid ${fieldName === "rep_first_name" ? "first" : "last"} name for the authorized representative.`,
    };
  }
  return null;
}

export function validateRepresentativeTitle(value: string): A2pValidationResult | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 2 || INVALID_TITLE_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return {
      field: "rep_business_title",
      code: "INVALID_REPRESENTATIVE_TITLE",
      severity: "error",
      message: "Enter the representative's real business title, for example Owner or Office Manager.",
    };
  }
  return null;
}

export function validateRepresentativeEmail(value: string): A2pValidationResult | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      field: "rep_email",
      code: "INVALID_REPRESENTATIVE_EMAIL",
      severity: "error",
      message: "Enter a valid email address for the authorized representative.",
    };
  }
  const domain = trimmed.split("@")[1] ?? "";
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      field: "rep_email",
      code: "DISPOSABLE_REPRESENTATIVE_EMAIL",
      severity: "error",
      message: "Use a real email for the authorized representative. Disposable or temporary emails can fail review.",
    };
  }
  return null;
}

export function normalizeRepresentativePhone(value: string): string {
  return normalizePhone(value);
}

export function validateRepresentativePhone(value: string): A2pValidationResult | null {
  const normalized = normalizeRepresentativePhone(value);
  if (!/^\+1\d{10}$/.test(normalized)) {
    return invalidRepresentativePhone();
  }
  const area = normalized.slice(2, 5);
  const exchange = normalized.slice(5, 8);
  if (!/^[2-9]\d{2}$/.test(area) || !/^[2-9]\d{2}$/.test(exchange)) {
    return invalidRepresentativePhone();
  }
  return null;
}

export function validateBusinessAddress(input: {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): A2pValidationResult[] {
  const issues: A2pValidationResult[] = [];
  if ((input.street ?? "").trim().length < 2) {
    issues.push({
      field: "street_address",
      code: "INVALID_STREET_ADDRESS",
      severity: "error",
      message: "Enter the business street address.",
    });
  }
  if ((input.city ?? "").trim().length < 1) {
    issues.push({
      field: "city",
      code: "INVALID_CITY",
      severity: "error",
      message: "Enter the business city.",
    });
  }
  if (!/^[A-Z]{2}$/.test((input.region ?? "").trim().toUpperCase())) {
    issues.push({
      field: "state_region",
      code: "INVALID_STATE_REGION",
      severity: "error",
      message: "State must be a 2-letter abbreviation, for example IL.",
    });
  }
  if (!/^\d{5}(-\d{4})?$/.test((input.postalCode ?? "").trim())) {
    issues.push({
      field: "postal_code",
      code: "INVALID_POSTAL_CODE",
      severity: "error",
      message: "ZIP code must be 5 digits or ZIP+4.",
    });
  }
  if (((input.country ?? "US").trim().toUpperCase() || "US") !== "US") {
    issues.push({
      field: "country",
      code: "INVALID_COUNTRY",
      severity: "error",
      message: "Country must be US for automated A2P onboarding.",
    });
  }
  return issues;
}

export function validateBusinessType(value: string): A2pValidationResult | null {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return unsupportedBusinessType();
  }
  if (normalized in SUPPORTED_BUSINESS_TYPE_MAP || normalized === "NON_PROFIT" || normalized === "SOLE_PROPRIETOR") {
    return null;
  }
  return unsupportedBusinessType();
}

export function mapBusinessTypeForTwilio(value: string): string | null {
  const normalized = (value ?? "").trim();
  if (normalized in SUPPORTED_BUSINESS_TYPE_MAP) {
    return SUPPORTED_BUSINESS_TYPE_MAP[normalized as keyof typeof SUPPORTED_BUSINESS_TYPE_MAP].twilioValue;
  }
  if (normalized === "NON_PROFIT") return "Non-profit Corporation";
  if (normalized === "SOLE_PROPRIETOR") return "Sole Proprietorship";
  return null;
}

export function mapJobPositionForTwilio(value: string): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (SUPPORTED_JOB_POSITIONS.has(normalized)) return normalized;
  if (lower === "general manager") return "GM";
  if (lower === "vice president") return "VP";
  if (lower === "chief executive officer") return "CEO";
  if (lower === "chief financial officer") return "CFO";
  if (lower === "owner" || lower === "office manager" || lower === "manager" || lower === "dentist") {
    return "Other";
  }
  return "Other";
}

export function validateWebsiteUrl(value: string): A2pValidationResult | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return {
      field: "website",
      code: "MISSING_WEBSITE_URL",
      severity: "error",
      message: "Enter a valid website URL that starts with https://",
    };
  }
  if (/\s/.test(trimmed)) {
    return invalidWebsiteResult();
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalidWebsiteResult();
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) {
    return invalidWebsiteResult();
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return invalidWebsiteResult();
  }
  if (host === "app.missedcallsdental.com") {
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.startsWith("/business/")) {
      return {
        field: "website",
        code: "INVALID_BUSINESS_WEBSITE_ROUTE",
        severity: "error",
        message: "Use a public business website URL, not an authenticated app page.",
      };
    }
  }
  return null;
}

export function validateCampaignContent(input: {
  clinicName: string;
  campaign: A2pCampaignContent;
}): A2pValidationResult[] {
  const issues: A2pValidationResult[] = [];
  const clinicName = (input.clinicName ?? "").trim();
  const campaign = input.campaign;
  const description = campaign.description.trim();
  const messageFlow = campaign.messageFlow.trim();

  if (description.length < 40 || description.length > 4096) {
    issues.push(issue("campaign_description", "INVALID_CAMPAIGN_DESCRIPTION_LENGTH", "Campaign description must be between 40 and 4096 characters."));
  }
  if (clinicName && !description.toLowerCase().includes(clinicName.toLowerCase())) {
    issues.push(issue("campaign_description", "CAMPAIGN_DESCRIPTION_MISSING_CLINIC_NAME", "Campaign description must identify the clinic as the sender."));
  }
  if (/^missed calls dental sends/i.test(description) || SPAMMY_LANGUAGE_RE.test(description) || MEDICAL_PROMISE_RE.test(description)) {
    issues.push(issue("campaign_description", "INVALID_CAMPAIGN_DESCRIPTION_CONTENT", "Campaign description must stay clinic-first, factual, and non-promotional."));
  }

  if (messageFlow.length < 40 || messageFlow.length > 2049) {
    issues.push(issue("message_flow", "INVALID_MESSAGE_FLOW_LENGTH", "Message flow must be between 40 and 2049 characters."));
  }
  if (!/missed|inbound call|called/i.test(messageFlow) || !/STOP/i.test(messageFlow) || !/HELP/i.test(messageFlow)) {
    issues.push(issue("message_flow", "INVALID_MESSAGE_FLOW_CONTENT", "Message flow must explain the missed-call trigger and mention STOP and HELP."));
  }
  if (!/no marketing list|no third-party data/i.test(messageFlow)) {
    issues.push(issue("message_flow", "MISSING_CONSENT_CONTEXT", "Message flow must explain that the text is tied to the patient's own call, not a marketing list."));
  }

  if (campaign.sampleMessages.length < 2 || campaign.sampleMessages.length > 5) {
    issues.push(issue("sample_messages", "INVALID_SAMPLE_MESSAGE_COUNT", "Provide between 2 and 5 sample messages."));
  }

  let stopCount = 0;
  let helpCount = 0;
  for (const [index, sampleRaw] of campaign.sampleMessages.entries()) {
    const sample = sampleRaw.trim();
    if (sample.length < 20 || sample.length > 1024) {
      issues.push(issue(`sample_messages.${index}`, "INVALID_SAMPLE_MESSAGE_LENGTH", `Sample message ${index + 1} must be between 20 and 1024 characters.`));
    }
    if (!(clinicName && sample.toLowerCase().includes(clinicName.toLowerCase())) && !/\bthis is\b/i.test(sample)) {
      issues.push(issue(`sample_messages.${index}`, "MISSING_SAMPLE_SENDER_IDENTITY", `Sample message ${index + 1} must clearly identify the sender.`));
    }
    if (/STOP/i.test(sample)) stopCount += 1;
    if (/HELP/i.test(sample)) helpCount += 1;
    if (!campaign.hasEmbeddedLinks && LINK_RE.test(sample)) {
      issues.push(issue(`sample_messages.${index}`, "UNEXPECTED_LINK_IN_SAMPLE", `Sample message ${index + 1} includes a link, but hasEmbeddedLinks is false.`));
    }
    if (!campaign.hasEmbeddedPhone && PHONE_RE.test(sample)) {
      issues.push(issue(`sample_messages.${index}`, "UNEXPECTED_PHONE_IN_SAMPLE", `Sample message ${index + 1} includes a phone number, but hasEmbeddedPhone is false.`));
    }
    if (SPAMMY_LANGUAGE_RE.test(sample) || MEDICAL_PROMISE_RE.test(sample)) {
      issues.push(issue(`sample_messages.${index}`, "INVALID_SAMPLE_MESSAGE_CONTENT", `Sample message ${index + 1} contains wording that is too promotional or too strong for A2P review.`));
    }
  }

  if (stopCount === 0) {
    issues.push(issue("sample_messages", "MISSING_STOP_IN_SAMPLES", "At least one sample message must include STOP."));
  }
  if (helpCount === 0) {
    issues.push(issue("sample_messages", "MISSING_HELP_IN_SAMPLES", "At least one sample message must include HELP."));
  }

  return issues;
}

export function validateA2pPreflight(reviewPackage: A2pReviewPackage): A2pValidationResult[] {
  const issues: A2pValidationResult[] = [];
  const businessResource = findResource(reviewPackage.providerPayload.resources, "Business information (EndUser)");
  const addressResource = findResource(reviewPackage.providerPayload.resources, "Business address");

  const legalNameError = validateLegalBusinessName(reviewPackage.business.legalBusinessName ?? "");
  if (legalNameError) issues.push(legalNameError);

  if (!reviewPackage.business.einProvided) {
    issues.push({
      field: "business_registration_number",
      code: "MISSING_EIN",
      severity: "error",
      message: "Enter a valid 9-digit EIN, for example 12-3456789. It must match your legal business name.",
      operatorMessage:
        "Cannot submit: EIN is missing. Ask the clinic owner to enter a valid 9-digit EIN before A2P submission.",
    });
  } else if (!reviewPackage.business.einFormatValid) {
    issues.push(invalidEinResult());
  }

  const businessTypeError = validateBusinessType(reviewPackage.business.businessType ?? "");
  if (businessTypeError) issues.push(businessTypeError);
  if (!mapBusinessTypeForTwilio(reviewPackage.business.businessType ?? "")) {
    issues.push({
      field: "business_type",
      code: "UNMAPPED_BUSINESS_TYPE",
      severity: "error",
      message: "Choose the clinic's exact legal business structure before A2P submission.",
      operatorMessage: "Cannot submit: business type is not mapped to a Twilio-supported value.",
    });
  }

  if (fieldValue(businessResource, "Industry") !== "HEALTHCARE") {
    issues.push(issue("business_industry", "INVALID_BUSINESS_INDUSTRY", "Business industry must be HEALTHCARE."));
  }
  if (fieldValue(businessResource, "Business identity") !== "direct_customer") {
    issues.push(issue("business_identity", "INVALID_BUSINESS_IDENTITY", "Business identity must be direct_customer for clinic A2P registration."));
  }
  if (fieldValue(businessResource, "Regions of operation") !== "USA_AND_CANADA") {
    issues.push(issue("business_regions_of_operation", "INVALID_BUSINESS_REGION", "Regions of operation must be USA_AND_CANADA."));
  }

  const websiteError = validateWebsiteUrl(fieldValue(businessResource, "Website") ?? "");
  if (websiteError) issues.push(websiteError);

  const repFirstError = validateRepresentativeName(reviewPackage.representative.firstName ?? "", "rep_first_name");
  if (repFirstError) issues.push(repFirstError);
  const repLastError = validateRepresentativeName(reviewPackage.representative.lastName ?? "", "rep_last_name");
  if (repLastError) issues.push(repLastError);
  const repTitleError = validateRepresentativeTitle(reviewPackage.representative.title ?? "");
  if (repTitleError) issues.push(repTitleError);
  const repEmailError = validateRepresentativeEmail(reviewPackage.representative.email ?? "");
  if (repEmailError) issues.push(repEmailError);
  const repPhoneError = validateRepresentativePhone(reviewPackage.representative.phone ?? "");
  if (repPhoneError) issues.push(repPhoneError);
  if (!mapJobPositionForTwilio(reviewPackage.representative.title ?? "")) {
    issues.push(issue("job_position", "INVALID_JOB_POSITION", "Representative title could not be mapped to a supported Twilio job position."));
  }
  if (!reviewPackage.representative.authorized) {
    issues.push(issue("authorized", "MISSING_A2P_AUTHORIZATION", "The clinic owner must authorize the SMS approval details before submission."));
  }

  issues.push(
    ...validateBusinessAddress({
      street: fieldValue(addressResource, "Street"),
      city: fieldValue(addressResource, "City"),
      region: fieldValue(addressResource, "Region")?.toUpperCase() ?? null,
      postalCode: fieldValue(addressResource, "Postal code"),
      country: fieldValue(addressResource, "Country"),
    }),
  );

  if (!reviewPackage.messagingServiceSid) {
    issues.push(issue("messaging_service_sid", "MISSING_MESSAGING_SERVICE_SID", "Messaging Service SID is missing."));
  }
  if (reviewPackage.includedSenders.numbers.length === 0) {
    issues.push(issue("active_number", "MISSING_LOCAL_A2P_SENDER", "At least one active local number is required for A2P submission."));
  }

  issues.push(...validateCampaignContent({ clinicName: reviewPackage.clinicName, campaign: reviewPackage.campaign }));
  return issues;
}

export function firstValidationMessage(
  results: A2pValidationResult[],
  severity: A2pValidationSeverity = "error",
): string | null {
  return results.find((result) => result.severity === severity)?.operatorMessage
    ?? results.find((result) => result.severity === severity)?.message
    ?? null;
}

export function hasValidationErrors(results: A2pValidationResult[]): boolean {
  return results.some((result) => result.severity === "error");
}

function invalidEinResult(): A2pValidationResult {
  return {
    field: "business_registration_number",
    code: "INVALID_EIN_FORMAT",
    severity: "error",
    message: "Enter a valid 9-digit EIN, for example 12-3456789. It must match your legal business name.",
    operatorMessage:
      "Cannot submit: EIN format is invalid. Ask the clinic owner to enter a valid 9-digit EIN before A2P submission.",
  };
}

function invalidRepresentativePhone(): A2pValidationResult {
  return {
    field: "rep_phone",
    code: "INVALID_REPRESENTATIVE_PHONE",
    severity: "error",
    message: "Use a direct phone number for the authorized representative in U.S./Canada format.",
  };
}

function invalidWebsiteResult(): A2pValidationResult {
  return {
    field: "website",
    code: "INVALID_WEBSITE_URL",
    severity: "error",
    message: "Enter a valid website URL that starts with https://",
  };
}

function unsupportedBusinessType(): A2pValidationResult {
  return {
    field: "business_type",
    code: "UNMAPPED_BUSINESS_TYPE",
    severity: "error",
    message: "Choose the clinic's exact legal business structure before A2P submission.",
    operatorMessage: "Cannot submit: business type is not mapped to a Twilio-supported value.",
  };
}

function issue(field: string, code: string, message: string): A2pValidationResult {
  return { field, code, severity: "error", message };
}

function findResource(resources: A2pPayloadResource[], step: string): A2pPayloadResource | null {
  return resources.find((resource) => resource.step === step) ?? null;
}

function fieldValue(resource: A2pPayloadResource | null, label: string): string | null {
  return resource?.fields.find((field) => field.label === label)?.value ?? null;
}
