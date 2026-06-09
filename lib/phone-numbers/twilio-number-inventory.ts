// Pure helpers for the platform-admin "assign an existing Twilio number" flow.
//
// No I/O and no Twilio SDK import here so this stays unit-testable and never
// pulls the Twilio SDK into a test/browser bundle. The server service
// (`assign-existing-twilio.ts`) supplies already-fetched plain data.
//
// Number type is decided SERVER-SIDE from the E.164 string, never by the client.

export type AdminNumberType = "toll_free" | "local";

export type WebhookConfigStatus = "ok" | "needs_setup";

// NANP toll-free area codes (the product's supported set).
const TOLL_FREE_PREFIXES = new Set(["800", "833", "844", "855", "866", "877", "888"]);

// NANP (+1) area code, or null for anything that is not a +1AAANXXXXXX number.
function nanpAreaCode(e164: string): string | null {
  if (typeof e164 !== "string" || !e164.startsWith("+1") || e164.length < 5) return null;
  const ac = e164.slice(2, 5);
  return /^\d{3}$/.test(ac) ? ac : null;
}

/**
 * Classify a number as toll-free or local from its E.164 string. A +1 number
 * whose area code is a known toll-free prefix is `toll_free`; everything else is
 * treated as `local` (the more restrictive, paid path). Never trust a client.
 */
export function classifyNumberType(e164: string): AdminNumberType {
  const ac = nanpAreaCode(e164);
  return ac && TOLL_FREE_PREFIXES.has(ac) ? "toll_free" : "local";
}

// Normalize a webhook URL for comparison: trim, drop a single trailing slash.
function normalizeUrl(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/** OK when the number already points at the expected app endpoint, else needs setup. */
export function webhookConfigStatus(
  current: string | null | undefined,
  expected: string,
): WebhookConfigStatus {
  const cur = normalizeUrl(current);
  if (cur.length === 0) return "needs_setup";
  return cur === normalizeUrl(expected) ? "ok" : "needs_setup";
}

export type OwnedNumberInput = {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  twilioPurchasedAt: string | null; // ISO or null
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  voiceUrl: string | null;
  smsUrl: string | null;
};

export type UnassignedNumberItem = {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  numberType: AdminNumberType;
  twilioPurchasedAt: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  voiceConfig: WebhookConfigStatus;
  smsConfig: WebhookConfigStatus;
  // First version: only toll-free numbers with Voice + SMS are assignable here.
  assignableHere: boolean;
  notAssignableReason: string | null;
};

/**
 * Build the unassigned-inventory view: owned Twilio numbers that are NOT mapped to
 * any clinic row in an active/scheduled state. `assignedKeys` holds both the E.164
 * phone numbers and Twilio SIDs that are currently held (active or scheduled), so a
 * number is excluded if either identifier matches.
 */
export function buildUnassignedInventory(args: {
  owned: OwnedNumberInput[];
  assignedKeys: Set<string>;
  expected: { voiceUrl: string; smsUrl: string };
}): UnassignedNumberItem[] {
  const { owned, assignedKeys, expected } = args;
  const items: UnassignedNumberItem[] = [];
  for (const n of owned) {
    if (assignedKeys.has(n.phoneNumber) || assignedKeys.has(n.sid)) continue;

    const numberType = classifyNumberType(n.phoneNumber);
    const hasVoiceSms = Boolean(n.capabilities.voice && n.capabilities.sms);

    let assignableHere = false;
    let notAssignableReason: string | null = null;
    if (numberType === "local") {
      notAssignableReason = "Local numbers are not assignable from this tool yet.";
    } else if (!hasVoiceSms) {
      notAssignableReason = "Requires Voice + SMS capability.";
    } else {
      assignableHere = true;
    }

    items.push({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      numberType,
      twilioPurchasedAt: n.twilioPurchasedAt,
      capabilities: n.capabilities,
      voiceConfig: webhookConfigStatus(n.voiceUrl, expected.voiceUrl),
      smsConfig: webhookConfigStatus(n.smsUrl, expected.smsUrl),
      assignableHere,
      notAssignableReason,
    });
  }
  // Stable, useful order: assignable first, then by phone number.
  items.sort((a, b) => {
    if (a.assignableHere !== b.assignableHere) return a.assignableHere ? -1 : 1;
    return a.phoneNumber.localeCompare(b.phoneNumber);
  });
  return items;
}
