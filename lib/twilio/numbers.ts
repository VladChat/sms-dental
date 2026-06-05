import { createHash } from "crypto";
import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv } from "../env";
import type { LocalListInstanceOptions } from "twilio/lib/rest/api/v2010/account/availablePhoneNumberCountry/local";

// Server-side Twilio available-number search and purchase helpers.
//
// Rules from the build guide:
//   - Search is read-only. It must never purchase anything.
//   - Live purchase requires runtimeConfig.onboarding.twilioNumberPurchaseMode
//     to be "live"; that check is enforced by callers, not here, so this
//     module stays a pure wrapper around Twilio.
//   - Return only Voice + SMS capable numbers.
//   - Prefer numbers with address_requirements=none.
//
// Country scope (MVP): US and CA only. The country code is the ISO 3166-1
// alpha-2 code Twilio uses for AvailablePhoneNumbers (e.g. "US", "CA").

export type SupportedCountry = "US" | "CA";

export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = ["US", "CA"];

export function isSupportedCountry(value: unknown): value is SupportedCountry {
  return typeof value === "string" && (SUPPORTED_COUNTRIES as readonly string[]).includes(value);
}

export type NumberType = "local" | "toll_free";

export type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  address_requirements: string;
  recommended: boolean;
  /** Purchasable for this product: requires both Voice and SMS. */
  selectable: boolean;
  /** "local" or "toll_free" — lets the UI label cards correctly. */
  type: NumberType;
  /** ISO country the number belongs to (US or CA in this MVP). */
  country: SupportedCountry;
};

// Which capabilities a result must have to appear. Defaults to Voice + SMS (the
// product minimum); callers that pass nothing get the historical behavior.
export type RequiredCapabilities = { voice: boolean; sms: boolean; mms: boolean };
const DEFAULT_REQUIRED: RequiredCapabilities = { voice: true, sms: true, mms: false };

export type SearchAvailableLocalNumbersInput = {
  country: SupportedCountry;
  areaCode?: string;
  /** Twilio `contains` pattern (digits, optional `*` wildcards). */
  contains?: string;
  /** City / locality filter (Twilio `inLocality`). */
  inLocality?: string;
  inRegion?: string;
  inPostalCode?: string;
  /** Geo-radius anchor: an E.164 number to search near (Twilio `nearNumber`). */
  nearNumber?: string;
  /** Geo-radius anchor: "lat,long" pair to search near (Twilio `nearLatLong`). */
  nearLatLong?: string;
  /** Geo-radius distance in miles; only applied with `nearNumber` or `nearLatLong`. */
  distance?: number;
  /** Capability filters. Defaults to Voice + SMS. */
  required?: Partial<RequiredCapabilities>;
  limit?: number;
};

export async function searchAvailableLocalNumbers(
  input: SearchAvailableLocalNumbersInput,
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();
  const areaCodeNumber = input.areaCode ? Number(input.areaCode) : undefined;
  const limit = clampLimit(input.limit, 10);
  const required = { ...DEFAULT_REQUIRED, ...(input.required ?? {}) };
  const useNearNumber = Boolean(input.nearNumber) && !areaCodeNumber;
  const useNearLatLong = Boolean(input.nearLatLong) && !areaCodeNumber && !useNearNumber;

  const params: LocalListInstanceOptions = {
    // Capability filters: only constrain when required.
    ...(required.voice ? { voiceEnabled: true } : {}),
    ...(required.sms ? { smsEnabled: true } : {}),
    ...(required.mms ? { mmsEnabled: true } : {}),
    // Area code and geo-radius are mutually exclusive; area code wins.
    ...(typeof areaCodeNumber === "number" && Number.isFinite(areaCodeNumber)
      ? { areaCode: areaCodeNumber }
      : {}),
    ...(useNearNumber ? { nearNumber: input.nearNumber } : {}),
    ...(useNearLatLong ? { nearLatLong: input.nearLatLong } : {}),
    ...(useNearNumber || useNearLatLong ? { distance: input.distance ?? 25 } : {}),
    ...(input.contains ? { contains: input.contains } : {}),
    ...(input.inLocality ? { inLocality: input.inLocality } : {}),
    ...(input.inRegion ? { inRegion: input.inRegion } : {}),
    ...(input.inPostalCode ? { inPostalCode: input.inPostalCode } : {}),
    limit,
    excludeAllAddressRequired: true,
    excludeLocalAddressRequired: true,
    excludeForeignAddressRequired: true,
    beta: false,
  };

  const list = await client.availablePhoneNumbers(input.country).local.list(params);

  return rankAndMap({
    list,
    type: "local",
    country: input.country,
    preferredAreaCode: input.areaCode,
    required,
  });
}

export type SearchAvailableTollFreeNumbersInput = {
  country: SupportedCountry;
  /** Optional toll-free prefix filter (800, 833, 844, 855, 866, 877, 888). */
  prefix?: string;
  /** Twilio `contains` pattern (digits, optional `*` wildcards). Wins over prefix. */
  contains?: string;
  /** Capability filters. Defaults to Voice + SMS. */
  required?: Partial<RequiredCapabilities>;
  limit?: number;
};

export async function searchAvailableTollFreeNumbers(
  input: SearchAvailableTollFreeNumbersInput,
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();
  const limit = clampLimit(input.limit, 10);
  const contains = input.contains?.trim() || formatTollFreeContains(input.prefix);
  const required = { ...DEFAULT_REQUIRED, ...(input.required ?? {}) };

  const list = await client.availablePhoneNumbers(input.country).tollFree.list({
    ...(required.voice ? { voiceEnabled: true } : {}),
    ...(required.sms ? { smsEnabled: true } : {}),
    ...(required.mms ? { mmsEnabled: true } : {}),
    ...(contains ? { contains } : {}),
    limit,
    excludeAllAddressRequired: true,
  });

  return rankAndMap({
    list,
    type: "toll_free",
    country: input.country,
    required,
  });
}

// Twilio's TollFreeListInstance accepts a `contains` filter like "833*******"
// to match a prefix. Normalize a 3-digit prefix to the required pattern.
function formatTollFreeContains(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined;
  const digits = prefix.replace(/\D/g, "").slice(0, 3);
  if (digits.length !== 3) return undefined;
  return `${digits}*******`;
}

// Shared filter + mapper for local and toll-free results.
function rankAndMap(params: {
  list: TwilioAvailableNumberLike[];
  type: NumberType;
  country: SupportedCountry;
  preferredAreaCode?: string;
  required: RequiredCapabilities;
}): AvailableNumber[] {
  const req = params.required;
  const filtered = params.list.filter((n) => {
    if (typeof n.phoneNumber !== "string" || n.phoneNumber.length === 0) return false;
    if (req.voice && !n.capabilities?.voice) return false;
    if (req.sms && !n.capabilities?.SMS) return false;
    if (req.mms && !n.capabilities?.MMS) return false;
    return true;
  });

  const ranked = filtered
    .map((n) => {
      const phone = n.phoneNumber!;
      const addressReq = (n.addressRequirements ?? "none").toString();
      const voice = Boolean(n.capabilities?.voice);
      const sms = Boolean(n.capabilities?.SMS);
      let score = 0;
      if (params.type === "local" && n.locality && n.region) {
        score += 30;
      } else if (params.type === "local" && n.region) {
        score += 20;
      }
      if (
        params.type === "local" &&
        params.preferredAreaCode &&
        phoneAreaCode(phone) === params.preferredAreaCode
      ) {
        score += 5;
      }
      if (addressReq === "none") score += 2;
      const normalized: AvailableNumber = {
        phone_number: phone,
        friendly_name: (n.friendlyName ?? phone).toString(),
        locality: (n.locality as string | null) ?? null,
        region: (n.region as string | null) ?? null,
        postal_code: (n.postalCode as string | null) ?? null,
        capabilities: { voice, sms, mms: Boolean(n.capabilities?.MMS) },
        address_requirements: addressReq,
        recommended: false,
        // Product rule: a number is purchasable only with both Voice and SMS,
        // regardless of which capability filters were applied to the search.
        selectable: voice && sms,
        type: params.type,
        country: params.country,
      };
      return { score, normalized };
    })
    .sort((a, b) => b.score - a.score);

  const items = ranked.map((r) => r.normalized);
  // Recommend the top-ranked purchasable number with city metadata. If Twilio
  // returns no city metadata for any usable local result, recommend only when
  // there is exactly one usable option.
  const selectable = items.filter((i) => i.selectable);
  const firstSelectableWithLocality = selectable.find((i) => i.locality);
  const firstSelectable =
    firstSelectableWithLocality ??
    (selectable.length === 1 ? selectable[0] : undefined);
  if (firstSelectable) firstSelectable.recommended = true;
  return items;
}

// Minimal structural type of the rows Twilio's available-number lists return.
// We accept either local or toll-free shapes — the surface we use is identical.
type TwilioAvailableNumberLike = {
  phoneNumber?: string;
  friendlyName?: string;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  // Twilio SDK returns capabilities with mixed casing: SMS/MMS uppercase,
  // voice lowercase. We expose the normalized lowercase shape via AvailableNumber.
  capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
  addressRequirements?: string;
};

export type PurchaseInput = {
  phoneNumber: string;
  appBaseUrl: string;
  businessAddress: TwilioBusinessAddress;
  attachMessagingService?: boolean;
};

export type PurchaseResult = {
  sid: string;
  phoneNumber: string;
  addressSid: string | null;
  emergencyAddressSid: string | null;
  emergencyAddressStatus: string | null;
  messagingServiceSid: string | null;
};

export type TwilioBusinessAddress = {
  clinicId: string;
  customerName: string;
  street: string;
  streetSecondary: string | null;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: "US";
};

export class PurchaseConfigurationError extends Error {
  readonly step: "address_configuration" | "messaging_service_attach";
  readonly sid: string;
  readonly phoneNumber: string;
  readonly addressSid: string | null;
  readonly emergencyAddressSid: string | null;
  readonly emergencyAddressStatus: string | null;
  readonly messagingServiceSid: string | null;

  constructor(args: {
    step: "address_configuration" | "messaging_service_attach";
    message: string;
    sid: string;
    phoneNumber: string;
    addressSid?: string | null;
    emergencyAddressSid?: string | null;
    emergencyAddressStatus?: string | null;
    messagingServiceSid?: string | null;
  }) {
    super(args.message);
    this.name = "PurchaseConfigurationError";
    this.step = args.step;
    this.sid = args.sid;
    this.phoneNumber = args.phoneNumber;
    this.addressSid = args.addressSid ?? null;
    this.emergencyAddressSid = args.emergencyAddressSid ?? null;
    this.emergencyAddressStatus = args.emergencyAddressStatus ?? null;
    this.messagingServiceSid = args.messagingServiceSid ?? null;
  }
}

export async function purchaseNumberAndConfigure(
  input: PurchaseInput,
): Promise<PurchaseResult> {
  const client = getTwilioClient();
  const base = input.appBaseUrl.replace(/\/+$/, "");

  const created = await client.incomingPhoneNumbers.create({
    phoneNumber: input.phoneNumber,
    voiceUrl: `${base}/api/webhooks/twilio/voice/incoming`,
    voiceMethod: "POST",
    statusCallback: `${base}/api/webhooks/twilio/voice/status`,
    statusCallbackMethod: "POST",
    smsUrl: `${base}/api/webhooks/twilio/messaging/incoming`,
    smsMethod: "POST",
  });

  let configured = created;
  let addressSid: string | null = null;
  let emergencyAddressSid: string | null = null;
  let emergencyAddressStatus: string | null = null;
  try {
    const address = await createOrReuseEmergencyAddress(input.businessAddress);
    addressSid = address.sid;
    configured = await client.incomingPhoneNumbers(created.sid).update({
      addressSid,
      emergencyAddressSid: addressSid,
      emergencyStatus: "Active",
    });
    emergencyAddressSid = configured.emergencyAddressSid ?? addressSid;
    emergencyAddressStatus = configured.emergencyAddressStatus ?? null;
  } catch (err) {
    throw new PurchaseConfigurationError({
      step: "address_configuration",
      message: err instanceof Error ? err.message : "Twilio address configuration failed",
      sid: created.sid,
      phoneNumber: created.phoneNumber,
      addressSid,
      emergencyAddressSid,
      emergencyAddressStatus,
    });
  }

  let messagingServiceSid: string | null = null;
  if (input.attachMessagingService) {
    // Required for production readiness. If this fails after purchase, callers
    // must reconcile with the purchased PN SID rather than silently proceeding.
    try {
      const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
      await client.messaging.v1
        .services(TWILIO_MESSAGING_SERVICE_SID)
        .phoneNumbers.create({ phoneNumberSid: created.sid });
      messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    } catch {
      throw new PurchaseConfigurationError({
        step: "messaging_service_attach",
        message: "Twilio Messaging Service attach failed",
        sid: created.sid,
        phoneNumber: created.phoneNumber,
        addressSid,
        emergencyAddressSid,
        emergencyAddressStatus,
        messagingServiceSid,
      });
    }
  }

  return {
    sid: configured.sid,
    phoneNumber: configured.phoneNumber,
    addressSid,
    emergencyAddressSid,
    emergencyAddressStatus,
    messagingServiceSid,
  };
}

async function createOrReuseEmergencyAddress(
  input: TwilioBusinessAddress,
): Promise<{ sid: string }> {
  const client = getTwilioClient();
  const friendlyName = addressFriendlyName(input);
  const existing = await client.addresses.list({
    friendlyName,
    emergencyEnabled: true,
    isoCountry: input.isoCountry,
    limit: 1,
  });
  if (existing[0]?.sid) {
    return { sid: existing[0].sid };
  }

  const created = await client.addresses.create({
    customerName: truncate(input.customerName, 64),
    friendlyName,
    street: input.street,
    streetSecondary: input.streetSecondary ?? undefined,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    isoCountry: input.isoCountry,
    emergencyEnabled: true,
    autoCorrectAddress: true,
  });

  return { sid: created.sid };
}

function addressFriendlyName(input: TwilioBusinessAddress): string {
  const body = [
    input.customerName,
    input.street,
    input.streetSecondary ?? "",
    input.city,
    input.region,
    input.postalCode,
    input.isoCountry,
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 12);
  const clinic = input.clinicId.replace(/-/g, "").slice(0, 8);
  return `MCD ${clinic} ${hash}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/** Identifies a number as out-of-inventory (HTTP 400 21422 / 21452). */
export function isNumberNoLongerAvailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: number; status?: number };
  return e.code === 21422 || e.code === 21452 || e.status === 400;
}

// NANP numbers (US + CA): +1AAANNNXXXX. Returns null for anything else.
export function phoneAreaCode(e164: string): string | null {
  if (typeof e164 !== "string" || !e164.startsWith("+1") || e164.length < 5) {
    return null;
  }
  return e164.slice(2, 5);
}

function clampLimit(raw: number | undefined, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(raw)));
}
