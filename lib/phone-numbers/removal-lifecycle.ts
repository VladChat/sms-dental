import { randomUUID } from "crypto";

import { getDb } from "../db/client";
import { logger } from "../logging/logger";
import {
  syncNumberSubscriptionQuantities,
  type NumberSubscriptionQuantities,
} from "../billing/stripe-number-subscription-sync";

const REMOVAL_GRACE_DAYS = 30;

type LifecycleRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  number_type: "toll_free" | "local";
  billing_class: "legacy" | "included" | "additional";
  is_active: boolean;
  removal_status: "active" | "scheduled" | "permanently_removed";
  permanent_removal_at: Date | null;
  twilio_phone_number_sid: string | null;
  twilio_release_status: "not_required" | "pending" | "released" | "failed";
};

type BillingContextRow = {
  stripe_subscription_id: string | null;
  billing_status: string;
  stripe_additional_number_subscription_item_id: string | null;
  stripe_local_number_subscription_item_id: string | null;
  stripe_local_sms_compliance_subscription_item_id: string | null;
};

export type PhoneNumberLifecycleResult =
  | { ok: true; phoneNumber: string; permanentRemovalAt?: string | null }
  | {
      ok: false;
      error:
        | "not_found"
        | "already_removed"
        | "not_scheduled"
        | "restore_window_closed"
        | "billing_configuration_missing"
        | "billing_sync_failed";
      message: string;
    };

export async function schedulePhoneNumberRemoval(args: {
  clinicId: string;
  phoneNumberId: string;
  actorProfileId: string;
  actorEmail: string | null;
}): Promise<PhoneNumberLifecycleResult> {
  const snapshot = await readLifecycleSnapshot(args.clinicId);
  const target = snapshot.numbers.find((n) => n.id === args.phoneNumberId);
  if (!target) {
    return { ok: false, error: "not_found", message: "Phone number not found." };
  }
  if (target.removal_status === "permanently_removed") {
    return {
      ok: false,
      error: "already_removed",
      message: "This number has already been permanently removed.",
    };
  }
  if (target.removal_status === "scheduled") {
    return {
      ok: true,
      phoneNumber: target.phone_number,
      permanentRemovalAt: target.permanent_removal_at?.toISOString() ?? null,
    };
  }

  const desired = desiredQuantities(snapshot.numbers, {
    targetId: target.id,
    targetStatus: "scheduled",
  });
  const sync = await syncIfNeeded({
    clinicId: args.clinicId,
    billing: snapshot.billing,
    desired,
    actionId: `remove-${target.id}-${randomUUID()}`,
    force: currentlyHasPaidAddOns(snapshot.numbers),
  });
  if (!sync.ok) return sync;

  const sql = getDb();
  const rows = await sql<{ phone_number: string; permanent_removal_at: Date }[]>`
    update public.clinic_phone_numbers set
      is_active = false,
      removal_status = 'scheduled',
      removal_requested_at = now(),
      removal_requested_by_profile_id = ${args.actorProfileId},
      removal_requested_by_email = ${args.actorEmail},
      permanent_removal_at = now() + (${REMOVAL_GRACE_DAYS}::int * interval '1 day'),
      restored_at = null,
      restored_by_profile_id = null,
      restored_by_email = null,
      twilio_release_status = case
        when twilio_phone_number_sid is null then 'not_required'
        else 'pending'
      end,
      twilio_release_error = null
    where id = ${args.phoneNumberId}
      and clinic_id = ${args.clinicId}
      and removal_status = 'active'
    returning phone_number, permanent_removal_at
  `;
  const row = rows[0];
  if (!row) {
    return { ok: false, error: "not_found", message: "Phone number not found." };
  }
  logger.info("phone_number.removal.scheduled", {
    clinicId: args.clinicId,
    phoneNumberId: args.phoneNumberId,
  });
  return {
    ok: true,
    phoneNumber: row.phone_number,
    permanentRemovalAt: row.permanent_removal_at.toISOString(),
  };
}

export async function restoreScheduledPhoneNumber(args: {
  clinicId: string;
  phoneNumberId: string;
  actorProfileId: string;
  actorEmail: string | null;
}): Promise<PhoneNumberLifecycleResult> {
  const snapshot = await readLifecycleSnapshot(args.clinicId);
  const target = snapshot.numbers.find((n) => n.id === args.phoneNumberId);
  if (!target) {
    return { ok: false, error: "not_found", message: "Phone number not found." };
  }
  if (target.removal_status !== "scheduled") {
    return {
      ok: false,
      error: "not_scheduled",
      message: "This number is not scheduled for removal.",
    };
  }
  if (
    target.twilio_release_status === "released" ||
    (target.permanent_removal_at && target.permanent_removal_at.getTime() <= Date.now())
  ) {
    return {
      ok: false,
      error: "restore_window_closed",
      message: "This number can no longer be restored.",
    };
  }

  const desired = desiredQuantities(snapshot.numbers, {
    targetId: target.id,
    targetStatus: "active",
  });
  const sync = await syncIfNeeded({
    clinicId: args.clinicId,
    billing: snapshot.billing,
    desired,
    actionId: `restore-${target.id}-${randomUUID()}`,
    force: currentlyHasPaidAddOns(snapshot.numbers),
  });
  if (!sync.ok) return sync;

  const sql = getDb();
  const rows = await sql<{ phone_number: string }[]>`
    update public.clinic_phone_numbers set
      is_active = true,
      removal_status = 'active',
      permanent_removal_at = null,
      restored_at = now(),
      restored_by_profile_id = ${args.actorProfileId},
      restored_by_email = ${args.actorEmail},
      twilio_release_status = 'not_required',
      twilio_release_error = null
    where id = ${args.phoneNumberId}
      and clinic_id = ${args.clinicId}
      and removal_status = 'scheduled'
      and twilio_release_status <> 'released'
      and permanent_removal_at > now()
    returning phone_number
  `;
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      error: "restore_window_closed",
      message: "This number can no longer be restored.",
    };
  }
  logger.info("phone_number.removal.restored", {
    clinicId: args.clinicId,
    phoneNumberId: args.phoneNumberId,
  });
  return { ok: true, phoneNumber: row.phone_number };
}

async function readLifecycleSnapshot(clinicId: string): Promise<{
  billing: BillingContextRow;
  numbers: LifecycleRow[];
}> {
  const sql = getDb();
  const billingRows = await sql<BillingContextRow[]>`
    select
      stripe_subscription_id,
      billing_status,
      stripe_additional_number_subscription_item_id,
      stripe_local_number_subscription_item_id,
      stripe_local_sms_compliance_subscription_item_id
    from public.clinics
    where id = ${clinicId}
    limit 1
  `;
  const billing = billingRows[0];
  if (!billing) throw new Error("clinic not found for phone-number lifecycle");
  const numbers = await sql<LifecycleRow[]>`
    select
      id, clinic_id, phone_number, number_type, billing_class, is_active,
      removal_status, permanent_removal_at, twilio_phone_number_sid,
      twilio_release_status
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and removal_status <> 'permanently_removed'
  `;
  return { billing, numbers };
}

function desiredQuantities(
  rows: LifecycleRow[],
  target: { targetId: string; targetStatus: "active" | "scheduled" },
): NumberSubscriptionQuantities {
  let additionalTollFree = 0;
  let localNumbers = 0;
  for (const row of rows) {
    const removalStatus =
      row.id === target.targetId ? target.targetStatus : row.removal_status;
    if (removalStatus === "scheduled" || removalStatus === "permanently_removed") continue;
    if (row.number_type === "local") {
      localNumbers += 1;
    } else if (row.billing_class === "additional") {
      additionalTollFree += 1;
    }
  }
  return {
    additionalTollFree,
    localNumbers,
    localSmsCompliance: localNumbers > 0 ? 1 : 0,
  };
}

function currentlyHasPaidAddOns(rows: LifecycleRow[]): boolean {
  return rows.some((row) => {
    if (row.removal_status !== "active") return false;
    return row.number_type === "local" || row.billing_class === "additional";
  });
}

async function syncIfNeeded(args: {
  clinicId: string;
  billing: BillingContextRow;
  desired: NumberSubscriptionQuantities;
  actionId: string;
  force: boolean;
}): Promise<{ ok: true } | Extract<PhoneNumberLifecycleResult, { ok: false }>> {
  const hasPaidAddOns =
    args.force ||
    args.desired.additionalTollFree > 0 ||
    args.desired.localNumbers > 0 ||
    args.desired.localSmsCompliance > 0 ||
    Boolean(args.billing.stripe_additional_number_subscription_item_id) ||
    Boolean(args.billing.stripe_local_number_subscription_item_id) ||
    Boolean(args.billing.stripe_local_sms_compliance_subscription_item_id);
  if (!hasPaidAddOns) return { ok: true };
  if (!args.billing.stripe_subscription_id || args.billing.billing_status !== "active") {
    return {
      ok: false,
      error: "billing_sync_failed",
      message: "Billing is not active, so the number was not changed.",
    };
  }

  const sync = await syncNumberSubscriptionQuantities({
    clinicId: args.clinicId,
    stripeSubscriptionId: args.billing.stripe_subscription_id,
    existingItemIds: {
      additionalSubscriptionItemId:
        args.billing.stripe_additional_number_subscription_item_id,
      localNumberSubscriptionItemId:
        args.billing.stripe_local_number_subscription_item_id,
      localSmsComplianceSubscriptionItemId:
        args.billing.stripe_local_sms_compliance_subscription_item_id,
    },
    desired: args.desired,
    actionId: args.actionId,
  });
  if (sync.ok) return { ok: true };
  return {
    ok: false,
    error: sync.error,
    message: sync.message,
  };
}
