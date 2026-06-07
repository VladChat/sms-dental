import { randomUUID } from "crypto";
import type { Sql, TransactionSql } from "postgres";

import { getDb } from "../db/client";
import { logger } from "../logging/logger";
import {
  syncNumberSubscriptionQuantities,
  type NumberSubscriptionQuantities,
} from "../billing/stripe-number-subscription-sync";

const REMOVAL_GRACE_DAYS = 30;

type DbExecutor = Sql | TransactionSql;

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
  updated_at: Date;
};

type BillingContextRow = {
  stripe_subscription_id: string | null;
  billing_status: string;
  stripe_additional_number_subscription_item_id: string | null;
  stripe_local_number_subscription_item_id: string | null;
  stripe_local_sms_compliance_subscription_item_id: string | null;
};

type LifecycleSnapshot = {
  billing: BillingContextRow;
  numbers: LifecycleRow[];
  fingerprint: string;
};

type LifecycleFinalizeResult =
  | { kind: "applied"; phoneNumber: string; permanentRemovalAt: Date | null }
  | { kind: "already_in_desired_state"; phoneNumber: string; permanentRemovalAt: Date | null }
  | { kind: "already_removed"; phoneNumber: string }
  | { kind: "restore_window_closed"; phoneNumber: string }
  | { kind: "not_found" }
  | { kind: "drifted"; current: LifecycleSnapshot };

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

  const desired = desiredQuantitiesWithOverride(snapshot.numbers, {
    targetId: target.id,
    targetStatus: "scheduled",
  });
  const actionId = `remove-${target.id}-${randomUUID()}`;
  const sync = await syncIfNeeded({
    clinicId: args.clinicId,
    billing: snapshot.billing,
    desired,
    actionId,
    force: currentlyHasPaidAddOns(snapshot.numbers),
  });
  if (!sync.ok) return sync;

  const finalize = await finalizeScheduledRemoval({
    clinicId: args.clinicId,
    phoneNumberId: args.phoneNumberId,
    actorProfileId: args.actorProfileId,
    actorEmail: args.actorEmail,
    expectedFingerprint: snapshot.fingerprint,
  });
  if (finalize.kind === "applied" || finalize.kind === "already_in_desired_state") {
    logger.info("phone_number.removal.scheduled", {
      clinicId: args.clinicId,
      phoneNumberId: args.phoneNumberId,
      result: finalize.kind,
    });
    return {
      ok: true,
      phoneNumber: finalize.phoneNumber,
      permanentRemovalAt: finalize.permanentRemovalAt?.toISOString() ?? null,
    };
  }
  if (finalize.kind === "already_removed") {
    return {
      ok: false,
      error: "already_removed",
      message: "This number has already been permanently removed.",
    };
  }
  if (finalize.kind === "not_found") {
    return { ok: false, error: "not_found", message: "Phone number not found." };
  }
  if (finalize.kind !== "drifted") {
    return {
      ok: false,
      error: "billing_sync_failed",
      message: "We could not finish updating this number. Please refresh and try again.",
    };
  }

  await reconcileLifecycleBillingAfterDrift({
    clinicId: args.clinicId,
    snapshot: finalize.current,
    actionId: `${actionId}-reconcile`,
    event: "phone_number.removal.schedule_drift",
    phoneNumberId: args.phoneNumberId,
  });
  return {
    ok: false,
    error: "billing_sync_failed",
    message:
      "Billing changed while we were updating this number. We restored billing to the current account state. Please refresh and try again.",
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

  const desired = desiredQuantitiesWithOverride(snapshot.numbers, {
    targetId: target.id,
    targetStatus: "active",
  });
  const actionId = `restore-${target.id}-${randomUUID()}`;
  const sync = await syncIfNeeded({
    clinicId: args.clinicId,
    billing: snapshot.billing,
    desired,
    actionId,
    force: currentlyHasPaidAddOns(snapshot.numbers),
  });
  if (!sync.ok) return sync;

  const finalize = await finalizeRestore({
    clinicId: args.clinicId,
    phoneNumberId: args.phoneNumberId,
    actorProfileId: args.actorProfileId,
    actorEmail: args.actorEmail,
    expectedFingerprint: snapshot.fingerprint,
  });
  if (finalize.kind === "applied" || finalize.kind === "already_in_desired_state") {
    logger.info("phone_number.removal.restored", {
      clinicId: args.clinicId,
      phoneNumberId: args.phoneNumberId,
      result: finalize.kind,
    });
    return { ok: true, phoneNumber: finalize.phoneNumber };
  }
  if (finalize.kind === "restore_window_closed") {
    return {
      ok: false,
      error: "restore_window_closed",
      message: "This number can no longer be restored.",
    };
  }
  if (finalize.kind === "already_removed") {
    return {
      ok: false,
      error: "restore_window_closed",
      message: "This number can no longer be restored.",
    };
  }
  if (finalize.kind === "not_found") {
    return { ok: false, error: "not_found", message: "Phone number not found." };
  }
  if (finalize.kind !== "drifted") {
    return {
      ok: false,
      error: "billing_sync_failed",
      message: "We could not finish updating this number. Please refresh and try again.",
    };
  }

  await reconcileLifecycleBillingAfterDrift({
    clinicId: args.clinicId,
    snapshot: finalize.current,
    actionId: `${actionId}-reconcile`,
    event: "phone_number.removal.restore_drift",
    phoneNumberId: args.phoneNumberId,
  });
  return {
    ok: false,
    error: "billing_sync_failed",
    message:
      "Billing changed while we were updating this number. We restored billing to the current account state. Please refresh and try again.",
  };
}

async function finalizeScheduledRemoval(args: {
  clinicId: string;
  phoneNumberId: string;
  actorProfileId: string;
  actorEmail: string | null;
  expectedFingerprint: string;
}): Promise<LifecycleFinalizeResult> {
  const sql = getDb();
  return sql.begin(async (tx) => {
    await tx`select 1 from public.clinics where id = ${args.clinicId} for update`;
    const current = await readLifecycleSnapshot(args.clinicId, tx);
    const target = current.numbers.find((n) => n.id === args.phoneNumberId);
    if (!target) return { kind: "not_found" };
    if (target.removal_status === "permanently_removed") {
      return { kind: "already_removed", phoneNumber: target.phone_number };
    }
    if (target.removal_status === "scheduled") {
      return {
        kind: "already_in_desired_state",
        phoneNumber: target.phone_number,
        permanentRemovalAt: target.permanent_removal_at,
      };
    }
    if (current.fingerprint !== args.expectedFingerprint) {
      return { kind: "drifted", current };
    }

    const rows = await tx<{ phone_number: string; permanent_removal_at: Date }[]>`
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
      const refreshed = await readLifecycleSnapshot(args.clinicId, tx);
      return { kind: "drifted", current: refreshed };
    }
    return {
      kind: "applied",
      phoneNumber: row.phone_number,
      permanentRemovalAt: row.permanent_removal_at,
    };
  });
}

async function finalizeRestore(args: {
  clinicId: string;
  phoneNumberId: string;
  actorProfileId: string;
  actorEmail: string | null;
  expectedFingerprint: string;
}): Promise<LifecycleFinalizeResult> {
  const sql = getDb();
  return sql.begin(async (tx) => {
    await tx`select 1 from public.clinics where id = ${args.clinicId} for update`;
    const current = await readLifecycleSnapshot(args.clinicId, tx);
    const target = current.numbers.find((n) => n.id === args.phoneNumberId);
    if (!target) return { kind: "not_found" };
    if (target.removal_status === "permanently_removed") {
      return { kind: "already_removed", phoneNumber: target.phone_number };
    }
    if (
      target.twilio_release_status === "released" ||
      (target.permanent_removal_at && target.permanent_removal_at.getTime() <= Date.now())
    ) {
      return { kind: "restore_window_closed", phoneNumber: target.phone_number };
    }
    if (target.removal_status === "active") {
      return {
        kind: "already_in_desired_state",
        phoneNumber: target.phone_number,
        permanentRemovalAt: null,
      };
    }
    if (current.fingerprint !== args.expectedFingerprint) {
      return { kind: "drifted", current };
    }

    const rows = await tx<{ phone_number: string }[]>`
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
      const refreshed = await readLifecycleSnapshot(args.clinicId, tx);
      return { kind: "drifted", current: refreshed };
    }
    return {
      kind: "applied",
      phoneNumber: row.phone_number,
      permanentRemovalAt: null,
    };
  });
}

async function readLifecycleSnapshot(
  clinicId: string,
  q: DbExecutor = getDb(),
): Promise<LifecycleSnapshot> {
  const billingRows = await q<BillingContextRow[]>`
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
  const numbers = await q<LifecycleRow[]>`
    select
      id, clinic_id, phone_number, number_type, billing_class, is_active,
      removal_status, permanent_removal_at, twilio_phone_number_sid,
      twilio_release_status, updated_at
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and removal_status <> 'permanently_removed'
    order by id asc
  `;
  return { billing, numbers, fingerprint: lifecycleFingerprint(numbers) };
}

function lifecycleFingerprint(rows: LifecycleRow[]): string {
  return rows
    .map((row) => {
      const permanentRemovalAt = row.permanent_removal_at
        ? row.permanent_removal_at.toISOString()
        : "";
      return [
        row.id,
        row.number_type,
        row.billing_class,
        row.is_active ? "1" : "0",
        row.removal_status,
        permanentRemovalAt,
        row.twilio_release_status,
        row.updated_at.toISOString(),
      ].join(":");
    })
    .join("|");
}

function desiredQuantitiesWithOverride(
  rows: LifecycleRow[],
  target?: { targetId: string; targetStatus: "active" | "scheduled" },
): NumberSubscriptionQuantities {
  let additionalTollFree = 0;
  let localNumbers = 0;
  for (const row of rows) {
    const removalStatus =
      target && row.id === target.targetId ? target.targetStatus : row.removal_status;
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

async function reconcileLifecycleBillingAfterDrift(args: {
  clinicId: string;
  snapshot: LifecycleSnapshot;
  actionId: string;
  event: string;
  phoneNumberId: string;
}): Promise<void> {
  const desired = desiredQuantitiesWithOverride(args.snapshot.numbers);
  const sync = await syncIfNeeded({
    clinicId: args.clinicId,
    billing: args.snapshot.billing,
    desired,
    actionId: args.actionId,
    force: currentlyHasPaidAddOns(args.snapshot.numbers),
  });
  if (sync.ok) {
    logger.warn(args.event, {
      clinicId: args.clinicId,
      phoneNumberId: args.phoneNumberId,
      reconciled: true,
    });
    return;
  }
  logger.error(`${args.event}.reconcile_failed`, {
    clinicId: args.clinicId,
    phoneNumberId: args.phoneNumberId,
    error: sync.error,
    reconcile_message: sync.message,
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
