import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv } from "../env";

// Server-side Twilio available-number search and purchase helpers.
//
// Rules from the build guide:
//   - Search is read-only. It must never purchase anything.
//   - Purchase requires TWILIO_NUMBER_PURCHASE_ENABLED=true; that check is
//     enforced by the API route, not here, so this module stays a pure
//     wrapper around Twilio.
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
  /** "local" or "toll_free" — lets the UI label cards correctly. */
  type: NumberType;
  /** ISO country the number belongs to (US or CA in this MVP). */
  country: SupportedCountry;
};

export type SearchAvailableLocalNumbersInput = {
  country: SupportedCountry;
  areaCode?: string;
  inRegion?: string;
  inPostalCode?: string;
  limit?: number;
};

export async function searchAvailableLocalNumbers(
  input: SearchAvailableLocalNumbersInput,
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();
  const areaCodeNumber = input.areaCode ? Number(input.areaCode) : undefined;
  const limit = clampLimit(input.limit, 10);

  const list = await client.availablePhoneNumbers(input.country).local.list({
    smsEnabled: true,
    voiceEnabled: true,
    ...(typeof areaCodeNumber === "number" && Number.isFinite(areaCodeNumber)
      ? { areaCode: areaCodeNumber }
      : {}),
    ...(input.inRegion ? { inRegion: input.inRegion } : {}),
    ...(input.inPostalCode ? { inPostalCode: input.inPostalCode } : {}),
    limit,
    excludeAllAddressRequired: true,
  });

  return rankAndMap({
    list,
    type: "local",
    country: input.country,
    preferredAreaCode: input.areaCode,
  });
}

export type SearchAvailableTollFreeNumbersInput = {
  country: SupportedCountry;
  /** Optional toll-free prefix filter (800, 833, 844, 855, 866, 877, 888). */
  prefix?: string;
  limit?: number;
};

export async function searchAvailableTollFreeNumbers(
  input: SearchAvailableTollFreeNumbersInput,
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();
  const limit = clampLimit(input.limit, 10);
  const contains = formatTollFreeContains(input.prefix);

  const list = await client.availablePhoneNumbers(input.country).tollFree.list({
    smsEnabled: true,
    voiceEnabled: true,
    ...(contains ? { contains } : {}),
    limit,
    excludeAllAddressRequired: true,
  });

  return rankAndMap({
    list,
    type: "toll_free",
    country: input.country,
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
}): AvailableNumber[] {
  const filtered = params.list.filter(
    (n) =>
      Boolean(n.capabilities?.voice) &&
      Boolean(n.capabilities?.sms) &&
      typeof n.phoneNumber === "string" &&
      n.phoneNumber.length > 0,
  );

  const ranked = filtered
    .map((n) => {
      const phone = n.phoneNumber!;
      const addressReq = (n.addressRequirements ?? "none").toString();
      let score = 0;
      if (
        params.type === "local" &&
        params.preferredAreaCode &&
        phoneAreaCode(phone) === params.preferredAreaCode
      ) {
        score += 10;
      }
      if (addressReq === "none") score += 2;
      const normalized: AvailableNumber = {
        phone_number: phone,
        friendly_name: (n.friendlyName ?? phone).toString(),
        locality: (n.locality as string | null) ?? null,
        region: (n.region as string | null) ?? null,
        postal_code: (n.postalCode as string | null) ?? null,
        capabilities: {
          voice: Boolean(n.capabilities?.voice),
          sms: Boolean(n.capabilities?.sms),
          mms: Boolean(n.capabilities?.mms),
        },
        address_requirements: addressReq,
        recommended: false,
        type: params.type,
        country: params.country,
      };
      return { score, normalized };
    })
    .sort((a, b) => b.score - a.score);

  const items = ranked.map((r) => r.normalized);
  if (items.length > 0) items[0]!.recommended = true;
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
  capabilities?: { voice?: boolean; sms?: boolean; mms?: boolean };
  addressRequirements?: string;
};

export type PurchaseInput = {
  phoneNumber: string;
  appBaseUrl: string;
  attachMessagingService?: boolean;
};

export type PurchaseResult = {
  sid: string;
  phoneNumber: string;
};

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

  if (input.attachMessagingService) {
    // Best-effort: add to Messaging Service so outbound SMS can reuse it.
    // Errors here should not fail the purchase since the number is already
    // provisioned. The caller logs failure separately.
    try {
      const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
      await client.messaging.v1
        .services(TWILIO_MESSAGING_SERVICE_SID)
        .phoneNumbers.create({ phoneNumberSid: created.sid });
    } catch {
      // intentionally swallow; status callback updates remain unaffected
    }
  }

  return {
    sid: created.sid,
    phoneNumber: created.phoneNumber,
  };
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
  return Math.max(1, Math.min(20, Math.floor(raw)));
}
