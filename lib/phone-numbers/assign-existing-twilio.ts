import { getDb } from "../db/client";
import { billingConfig } from "../../config/billing.config";
import { getAppDomainsSafe } from "../env";
import { logger } from "../logging/logger";
import {
  configureIncomingPhoneNumberWebhooks,
  fetchOwnedIncomingPhoneNumberBySid,
  listOwnedIncomingPhoneNumbers,
  standardTwilioWebhookUrls,
  type OwnedTwilioNumber,
} from "../twilio/numbers";
import {
  buildUnassignedInventory,
  classifyNumberType,
  webhookConfigStatus,
  type UnassignedNumberItem,
  type WebhookConfigStatus,
} from "./twilio-number-inventory";

// Platform-admin workflow: assign an EXISTING, already-owned Twilio number to a
// clinic. This never buys or releases a Twilio number. Number type and billing
// class are decided server-side; the client supplies only the selected SID.
//
// First version supports assigning an unassigned TOLL-FREE number as a clinic's
// INCLUDED toll-free number (billing_class='included', $0). Local numbers and
// "additional" toll-free are intentionally blocked here (see below).

export type AssignExistingErrorCode =
  | "clinic_not_found"
  | "not_found_in_twilio"
  | "local_not_supported"
  | "missing_capability"
  | "already_assigned"
  | "previously_removed"
  | "clinic_has_toll_free"
  | "twilio_configuration_failed"
  | "assign_failed";

export type AssignExistingResult =
  | {
      ok: true;
      phoneNumber: string;
      twilioSid: string;
      numberType: "toll_free";
      billingClass: "included";
      voiceConfig: WebhookConfigStatus;
      smsConfig: WebhookConfigStatus;
      reconfigured: boolean;
    }
  | { ok: false; error: AssignExistingErrorCode; message: string };

const MESSAGES: Record<AssignExistingErrorCode, string> = {
  clinic_not_found: "Clinic not found.",
  not_found_in_twilio: "That number is no longer in the Twilio account. Refresh the list.",
  local_not_supported:
    "Local numbers can't be assigned from this tool yet. Use the owner local-number flow.",
  missing_capability: "This number is missing the required Voice + SMS capability.",
  already_assigned: "That number is already assigned to a clinic.",
  previously_removed:
    "That number has a permanently-removed history row and needs manual reconciliation before reuse.",
  clinic_has_toll_free:
    "This clinic already has a toll-free number. Adding another is a paid add-on and isn't supported from this tool yet.",
  twilio_configuration_failed:
    "Could not configure the number's webhooks in Twilio. It was not assigned.",
  assign_failed: "Could not assign this number safely. Please try again.",
};

function err(code: AssignExistingErrorCode): Extract<AssignExistingResult, { ok: false }> {
  return { ok: false, error: code, message: MESSAGES[code] };
}

type AssignedKeyRow = { phone_number: string; twilio_phone_number_sid: string | null };

/**
 * List owned Twilio numbers that are NOT currently mapped to any clinic row in an
 * active/scheduled state. Read-only.
 */
export async function listUnassignedTwilioInventory(): Promise<{
  ok: boolean;
  items: UnassignedNumberItem[];
}> {
  const sql = getDb();
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
  const expected = standardTwilioWebhookUrls(appBaseUrl);

  const [owned, assignedRows] = await Promise.all([
    listOwnedIncomingPhoneNumbers(),
    sql<AssignedKeyRow[]>`
      select phone_number, twilio_phone_number_sid
      from public.clinic_phone_numbers
      where removal_status in ('active', 'scheduled')
    `,
  ]);

  const assignedKeys = new Set<string>();
  for (const r of assignedRows) {
    if (r.phone_number) assignedKeys.add(r.phone_number);
    if (r.twilio_phone_number_sid) assignedKeys.add(r.twilio_phone_number_sid);
  }

  const items = buildUnassignedInventory({
    owned: owned.map((n) => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      twilioPurchasedAt: n.twilioPurchasedAt ? n.twilioPurchasedAt.toISOString() : null,
      capabilities: n.capabilities,
      voiceUrl: n.voiceUrl,
      smsUrl: n.smsUrl,
    })),
    assignedKeys,
    expected: { voiceUrl: expected.voiceUrl, smsUrl: expected.smsUrl },
  });

  return { ok: true, items };
}

export async function assignExistingTwilioNumber(args: {
  clinicId: string;
  twilioSid: string;
  actorProfileId: string | null;
  actorEmail: string | null;
}): Promise<AssignExistingResult> {
  const sql = getDb();

  const clinicRows = await sql<{ id: string }[]>`
    select id from public.clinics where id = ${args.clinicId} limit 1
  `;
  if (clinicRows.length === 0) return err("clinic_not_found");

  // Re-fetch from Twilio by SID (never trust client-supplied number/type/config).
  let owned: OwnedTwilioNumber | null;
  try {
    owned = await fetchOwnedIncomingPhoneNumberBySid(args.twilioSid);
  } catch (e) {
    logger.error("admin.assign_existing.twilio_fetch_failed", {
      clinicId: args.clinicId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return err("assign_failed");
  }
  if (!owned) return err("not_found_in_twilio");

  const numberType = classifyNumberType(owned.phoneNumber);
  if (numberType === "local") return err("local_not_supported");
  if (!owned.capabilities.voice || !owned.capabilities.sms) return err("missing_capability");

  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
  if (!appBaseUrl) {
    logger.error("admin.assign_existing.app_base_url_missing", { clinicId: args.clinicId });
    return err("twilio_configuration_failed");
  }
  const expected = standardTwilioWebhookUrls(appBaseUrl);

  // Re-point webhooks only if missing/wrong; never silently assign a broken number.
  const needsConfig =
    webhookConfigStatus(owned.voiceUrl, expected.voiceUrl) !== "ok" ||
    webhookConfigStatus(owned.statusCallback, expected.statusCallback) !== "ok" ||
    webhookConfigStatus(owned.smsUrl, expected.smsUrl) !== "ok";
  let reconfigured = false;
  if (needsConfig) {
    try {
      owned = await configureIncomingPhoneNumberWebhooks({ sid: owned.sid, appBaseUrl });
      reconfigured = true;
    } catch (e) {
      logger.error("admin.assign_existing.configure_failed", {
        clinicId: args.clinicId,
        message: e instanceof Error ? e.message : "unknown",
      });
      return err("twilio_configuration_failed");
    }
  }

  const purchasedAt = owned.twilioPurchasedAt ?? new Date();
  const phoneNumber = owned.phoneNumber;
  const sid = owned.sid;
  const currency = billingConfig.currency;

  try {
    const result: AssignExistingResult = await sql.begin(async (tx) => {
      // Serialize per clinic; re-check DB inside the lock to avoid double-assign.
      await tx`select 1 from public.clinics where id = ${args.clinicId} for update`;

      const existing = await tx<{ removal_status: string }[]>`
        select removal_status from public.clinic_phone_numbers
        where phone_number = ${phoneNumber}
        limit 1
      `;
      if (existing[0]) {
        if (existing[0].removal_status === "permanently_removed") return err("previously_removed");
        return err("already_assigned");
      }

      // First version: only the clinic's INCLUDED toll-free slot. Adding a second
      // (additional, paid) toll-free is intentionally blocked here.
      const tollFree = await tx<{ one: number }[]>`
        select 1 as one from public.clinic_phone_numbers
        where clinic_id = ${args.clinicId}
          and number_type = 'toll_free'
          and removal_status in ('active', 'scheduled')
        limit 1
      `;
      if (tollFree.length > 0) return err("clinic_has_toll_free");

      const rows = await tx<{ phone_number: string }[]>`
        insert into public.clinic_phone_numbers
          (clinic_id, phone_number, number_type, twilio_phone_number_sid, role, is_active,
           source, billing_class, monthly_unit_amount_cents, currency,
           purchased_by_profile_id, purchased_by_email, activated_at,
           twilio_purchased_at, removal_status, twilio_release_status)
        values
          (${args.clinicId}, ${phoneNumber}, 'toll_free', ${sid}, 'office_texting', true,
           'admin', 'included', 0, ${currency},
           ${args.actorProfileId}, ${args.actorEmail}, now(),
           ${purchasedAt}, 'active', 'not_required')
        returning phone_number
      `;
      if (!rows[0]) throw new Error("insert returned no row");

      return {
        ok: true as const,
        phoneNumber,
        twilioSid: sid,
        numberType: "toll_free" as const,
        billingClass: "included" as const,
        voiceConfig: webhookConfigStatus(owned!.voiceUrl, expected.voiceUrl),
        smsConfig: webhookConfigStatus(owned!.smsUrl, expected.smsUrl),
        reconfigured,
      };
    });
    return result;
  } catch (e) {
    // Unique violation on phone_number = concurrent assignment won the race.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
      return err("already_assigned");
    }
    logger.error("admin.assign_existing.insert_failed", {
      clinicId: args.clinicId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return err("assign_failed");
  }
}
