import { getDb } from "../db/client";
import { runtimeConfig } from "../../config/runtime.config";
import { billingConfig } from "../../config/billing.config";
import {
  computeNumberEntitlement,
  type NumberPurchaseBlockReason,
} from "../billing/number-entitlements";
import { getAppDomains, isTwilioNumberPurchaseEnabled } from "../env";
import {
  isNumberNoLongerAvailableError,
  phoneAreaCode,
  purchaseNumberAndConfigure,
} from "../twilio/numbers";
import { logger } from "../logging/logger";

// Shared, race-safe phone-number provisioning service used by BOTH the owner
// self-service purchase route and the admin manual purchase route. Twilio
// purchase logic lives ONLY here (no route duplicates it).
//
// Safety model:
//   - Entitlement is recomputed from live DB state inside a clinic-row lock.
//   - A durable purchase-attempt row serializes concurrent purchases (one
//     in-flight per clinic; unique partial index is the backstop).
//   - The DB transaction is NOT held open across the Twilio call.
//   - A purchased Twilio SID is persisted into the attempt immediately and is
//     never hidden; uncertain outcomes are marked reconciliation_required.
//   - No charge, no Stripe subscription, and no SMS recovery happen here.
//
// Phase status: the included (first) number path is complete. The additional
// (paid) path + Stripe quantity sync is implemented in a later phase; until then
// it is guarded BEFORE any external call (and is unreachable while no clinic has
// an active paid subscription).

export type ProvisionSource = "owner_self_service" | "admin";

export type ProvisionInput = {
  clinicId: string;
  phoneNumber: string; // trusted server value; validated E.164 upstream
  actorProfileId: string | null;
  actorEmail: string | null;
  source: ProvisionSource;
  additionalBillingAuthorized: boolean;
};

export type ProvisionErrorCode =
  | NumberPurchaseBlockReason
  | "additional_billing_authorization_required"
  | "number_already_assigned"
  | "number_no_longer_available"
  | "purchase_disabled"
  | "billing_sync_failed"
  | "reconciliation_required"
  | "purchase_failed";

export type AssignedNumber = {
  id: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  billingClass: string;
  monthlyUnitAmountCents: number;
  currency: string;
  activatedAt: string | null;
  createdAt: string;
};

export type ProvisionResult =
  | { ok: true; assigned: AssignedNumber; attemptId: string; twilioSid: string }
  | { ok: false; error: ProvisionErrorCode; message: string; attemptId?: string };

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

// A thrown Twilio API rejection (has a numeric code + HTTP status) means no
// number was created. A transport/timeout error (no status) is uncertain.
function isDefiniteTwilioApiError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };
  return typeof e.status === "number" && typeof e.code === "number";
}

const BLOCK_MESSAGES: Record<NumberPurchaseBlockReason, string> = {
  payment_method_required: "Add a payment method before purchasing a number.",
  number_purchases_revoked:
    "New number purchases are disabled for this account. Contact support.",
  number_limit_reached:
    "You have reached your current business-number limit. Contact support to request a higher limit.",
  purchase_in_progress: "A number purchase is already in progress. Please wait a moment.",
  paid_plan_required: "Start the paid plan to add another business number.",
  subscription_not_active:
    "Your subscription is not active. Update billing before adding another number.",
  billing_configuration_missing:
    "Number billing is not configured yet. Please try again later.",
};

/**
 * Purchase and assign a business number for a clinic. Returns a stable
 * machine-readable error on any block/failure; never throws to the caller for
 * expected outcomes.
 */
export async function provisionClinicPhoneNumber(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const sql = getDb();
  const { clinicId, phoneNumber, actorProfileId, actorEmail, source } = input;

  // ── 1. Gate + open a durable attempt inside a clinic-row lock ───────────────
  let gate:
    | { kind: "blocked"; error: ProvisionErrorCode; message: string }
    | { kind: "started"; attemptId: string; slotClass: "included" | "additional" };
  try {
    gate = await sql.begin(async (tx) => {
      // Serialize per clinic: a concurrent call blocks here until we commit.
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;

      const ent = await computeNumberEntitlement(tx, clinicId);
      if (ent.blockReason) {
        return {
          kind: "blocked" as const,
          error: ent.blockReason,
          message: BLOCK_MESSAGES[ent.blockReason],
        };
      }

      // Never re-purchase/replace a number already active on this clinic.
      const assigned = await tx<{ one: number }[]>`
        select 1 as one from public.clinic_phone_numbers
        where clinic_id = ${clinicId} and phone_number = ${phoneNumber} and is_active = true
        limit 1
      `;
      if (assigned.length > 0) {
        return {
          kind: "blocked" as const,
          error: "number_already_assigned" as const,
          message: "That number is already assigned to your clinic.",
        };
      }

      const slotClass = ent.nextSlotClass;
      if (slotClass === "additional" && !input.additionalBillingAuthorized) {
        return {
          kind: "blocked" as const,
          error: "additional_billing_authorization_required" as const,
          message:
            "Authorize the additional $20/month charge before purchasing this number.",
        };
      }

      // Additional (paid) provisioning is enabled in a later phase. It is
      // unreachable here while no clinic has an active paid subscription; guard
      // BEFORE any attempt row or external call so no number is ever stranded.
      if (slotClass === "additional") {
        logger.warn("provisioning.additional_not_enabled", { clinicId });
        return {
          kind: "blocked" as const,
          error: "purchase_failed" as const,
          message: "Additional-number purchasing is not available yet.",
        };
      }

      try {
        const ins = await tx<{ id: string }[]>`
          insert into public.clinic_phone_number_purchase_attempts
            (clinic_id, requested_phone_number, requested_by_profile_id,
             requested_by_email, source, slot_class, status)
          values
            (${clinicId}, ${phoneNumber}, ${actorProfileId}, ${actorEmail},
             ${source}, ${slotClass}, 'started')
          returning id
        `;
        return { kind: "started" as const, attemptId: ins[0]!.id, slotClass };
      } catch (e) {
        if (isUniqueViolation(e)) {
          // Another in-flight attempt for this clinic or this number.
          return {
            kind: "blocked" as const,
            error: "purchase_in_progress" as const,
            message: BLOCK_MESSAGES.purchase_in_progress,
          };
        }
        throw e;
      }
    });
  } catch (err) {
    // Fail closed: if we cannot even evaluate entitlement / open an attempt, do
    // not proceed to any purchase.
    logger.error("provisioning.gate_failed", {
      clinicId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      error: "purchase_failed",
      message: "Could not start the purchase safely. Please try again.",
    };
  }

  if (gate.kind === "blocked") {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const attemptId = gate.attemptId;

  // ── 2. Twilio purchase gate (no transaction held open) ─────────────────────
  if (!isTwilioNumberPurchaseEnabled()) {
    await markAttempt(attemptId, { status: "cancelled", error_code: "purchase_disabled" });
    return {
      ok: false,
      error: "purchase_disabled",
      message: "Number purchase is disabled by environment flag.",
      attemptId,
    };
  }

  let appBaseUrl: string;
  try {
    ({ appBaseUrl } = getAppDomains());
  } catch {
    await markAttempt(attemptId, { status: "failed", error_code: "config_missing" });
    return {
      ok: false,
      error: "purchase_failed",
      message: "App base URL is not configured for webhook setup.",
      attemptId,
    };
  }

  // ── 3. Purchase the Twilio number ──────────────────────────────────────────
  let sid: string;
  let purchasedNumber: string;
  try {
    const purchased = await purchaseNumberAndConfigure({
      phoneNumber,
      appBaseUrl,
      attachMessagingService: true,
    });
    sid = purchased.sid;
    purchasedNumber = purchased.phoneNumber;
    // Persist the SID immediately so a later failure can never hide it.
    await markAttempt(attemptId, { status: "twilio_purchased", twilio_phone_number_sid: sid });
  } catch (err) {
    if (isNumberNoLongerAvailableError(err)) {
      await markAttempt(attemptId, {
        status: "failed",
        error_code: "number_no_longer_available",
      });
      return {
        ok: false,
        error: "number_no_longer_available",
        message: "That number is no longer available. Please search again.",
        attemptId,
      };
    }
    if (isDefiniteTwilioApiError(err)) {
      await markAttempt(attemptId, { status: "failed", error_code: "purchase_failed" });
      return {
        ok: false,
        error: "purchase_failed",
        message: "Number purchase failed. Please try another number.",
        attemptId,
      };
    }
    // Uncertain outcome — a number MAY have been purchased. Never claim it was
    // not. Mark for reconciliation; do not create an active mapping.
    logger.error("provisioning.twilio_uncertain", {
      clinicId,
      attemptId,
      message: err instanceof Error ? err.message : "unknown",
    });
    await markAttempt(attemptId, {
      status: "reconciliation_required",
      error_code: "twilio_outcome_uncertain",
    });
    return {
      ok: false,
      error: "reconciliation_required",
      message:
        "We could not confirm the number purchase. Our team will verify it before any charge — please do not retry.",
      attemptId,
    };
  }

  // ── 4. Included (first) number: assign + start trial (no charge) ────────────
  const trialDays = runtimeConfig.billing.trialDaysAfterActivation;
  try {
    const assigned = await sql.begin(async (tx) => {
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;

      const rows = await tx<
        {
          id: string;
          phone_number: string;
          role: string;
          is_active: boolean;
          billing_class: string;
          monthly_unit_amount_cents: number;
          currency: string;
          activated_at: Date | null;
          created_at: Date;
        }[]
      >`
        insert into public.clinic_phone_numbers
          (clinic_id, phone_number, twilio_phone_number_sid, role, is_active,
           source, billing_class, monthly_unit_amount_cents, currency,
           purchased_by_profile_id, purchased_by_email, activated_at)
        values
          (${clinicId}, ${purchasedNumber}, ${sid}, 'office_texting', true,
           ${source}, 'included', 0, ${billingConfig.currency},
           ${actorProfileId}, ${actorEmail}, now())
        on conflict (phone_number) do update set
          clinic_id = excluded.clinic_id,
          twilio_phone_number_sid = excluded.twilio_phone_number_sid,
          role = 'office_texting',
          is_active = true,
          source = excluded.source,
          billing_class = excluded.billing_class,
          monthly_unit_amount_cents = excluded.monthly_unit_amount_cents,
          currency = excluded.currency,
          purchased_by_profile_id = excluded.purchased_by_profile_id,
          purchased_by_email = excluded.purchased_by_email,
          activated_at = now(),
          suspended_at = null,
          suspended_by_profile_id = null,
          suspension_reason = null
        returning id, phone_number, role, is_active, billing_class,
                  monthly_unit_amount_cents, currency, activated_at, created_at
      `;
      const row = rows[0];
      if (!row) throw new Error("clinic_phone_numbers insert returned no row");

      // Start the trial from the clinic trial columns ONLY on first assignment.
      await tx`
        update public.clinics set
          local_number_status = 'assigned',
          trial_ends_at = case when trial_started_at is null
            then now() + (${trialDays}::int * interval '1 day') else trial_ends_at end,
          billing_status = case when trial_started_at is null
            then 'trialing' else billing_status end,
          trial_started_at = coalesce(trial_started_at, now())
        where id = ${clinicId}
      `;

      await tx`
        update public.clinic_phone_number_purchase_attempts
        set status = 'assigned'
        where id = ${attemptId}
      `;
      return row;
    });

    logger.info("provisioning.assigned", {
      clinicId,
      attemptId,
      source,
      slotClass: "included",
      areaCode: phoneAreaCode(purchasedNumber),
    });

    return {
      ok: true,
      attemptId,
      twilioSid: sid,
      assigned: {
        id: assigned.id,
        phoneNumber: assigned.phone_number,
        role: assigned.role,
        isActive: assigned.is_active,
        billingClass: assigned.billing_class,
        monthlyUnitAmountCents: assigned.monthly_unit_amount_cents,
        currency: assigned.currency,
        activatedAt: assigned.activated_at ? assigned.activated_at.toISOString() : null,
        createdAt: assigned.created_at.toISOString(),
      },
    };
  } catch (err) {
    // Twilio number IS purchased (SID persisted) but the DB assignment failed.
    // Never lose the SID; surface for reconciliation.
    logger.error("provisioning.assignment_save_failed", {
      clinicId,
      attemptId,
      message: err instanceof Error ? err.message : "unknown",
    });
    await markAttempt(attemptId, {
      status: "reconciliation_required",
      error_code: "assignment_save_failed",
    });
    return {
      ok: false,
      error: "reconciliation_required",
      message:
        "The number was purchased but could not be assigned automatically. Our team will finish setup.",
      attemptId,
    };
  }
}

type AttemptUpdate = {
  status: string;
  twilio_phone_number_sid?: string;
  error_code?: string;
  error_message?: string;
};

async function markAttempt(attemptId: string, fields: AttemptUpdate): Promise<void> {
  const sql = getDb();
  try {
    await sql`
      update public.clinic_phone_number_purchase_attempts set
        status = ${fields.status},
        twilio_phone_number_sid = coalesce(${fields.twilio_phone_number_sid ?? null}, twilio_phone_number_sid),
        error_code = ${fields.error_code ?? null},
        error_message = ${fields.error_message ?? null}
      where id = ${attemptId}
    `;
  } catch (err) {
    logger.error("provisioning.attempt_update_failed", {
      attemptId,
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}
