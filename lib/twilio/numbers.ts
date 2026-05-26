import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv } from "../env";

// Server-side Twilio available-number search and purchase helpers.
//
// Rules from the build guide:
//   - Search is read-only. It must never purchase anything.
//   - Purchase requires TWILIO_NUMBER_PURCHASE_ENABLED=true; that check is
//     enforced by the API route, not here, so this module stays a pure
//     wrapper around Twilio.
//   - Return only Voice + SMS capable local US numbers.
//   - Prefer numbers with address_requirements=none.

export type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  address_requirements: string;
  recommended: boolean;
};

export type SearchAvailableLocalNumbersInput = {
  areaCode?: string;
  limit?: number;
};

export async function searchAvailableLocalNumbers(
  input: SearchAvailableLocalNumbersInput,
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();
  const areaCodeNumber = input.areaCode ? Number(input.areaCode) : undefined;
  const limit = clampLimit(input.limit, 10);

  const list = await client.availablePhoneNumbers("US").local.list({
    smsEnabled: true,
    voiceEnabled: true,
    ...(typeof areaCodeNumber === "number" && Number.isFinite(areaCodeNumber)
      ? { areaCode: areaCodeNumber }
      : {}),
    limit,
    excludeAllAddressRequired: true,
  });

  const filtered = list.filter(
    (n) =>
      Boolean(n.capabilities?.voice) &&
      Boolean(n.capabilities?.sms) &&
      typeof n.phoneNumber === "string" &&
      n.phoneNumber.length > 0,
  );

  // Rank: prefer matching area code, then no address requirement.
  const wantedAreaCode = input.areaCode;
  const ranked = filtered
    .map((n) => {
      const phone = n.phoneNumber!;
      const addressReq = (n.addressRequirements ?? "none").toString();
      let score = 0;
      if (wantedAreaCode && phoneAreaCode(phone) === wantedAreaCode) score += 10;
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
      };
      return { score, normalized };
    })
    .sort((a, b) => b.score - a.score);

  const items = ranked.map((r) => r.normalized);
  if (items.length > 0) items[0]!.recommended = true;
  return items;
}

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

export function phoneAreaCode(e164: string): string | null {
  // E.164 US numbers: +1AAANNNXXXX
  if (typeof e164 !== "string" || !e164.startsWith("+1") || e164.length < 5) {
    return null;
  }
  return e164.slice(2, 5);
}

function clampLimit(raw: number | undefined, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(raw)));
}
