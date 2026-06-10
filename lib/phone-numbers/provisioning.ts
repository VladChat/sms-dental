import { getDb } from "../db/client";
import { runtimeConfig } from "../../config/runtime.config";
import { billingConfig } from "../../config/billing.config";
import {
  computeNumberEntitlement,
  decideTypedPurchase,
  type NumberPurchaseBlockReason,
  type RequestedNumberType,
} from "../billing/number-entitlements";
import {
  getAppDomains,
  getTwilioNumberPurchaseMode,
  isClinicAllowedForLivePurchase,
} from "../env";
import {
  isNumberNoLongerAvailableError,
  phoneAreaCode,
  PurchaseConfigurationError,
  purchaseNumberAndConfigure,
  type TwilioBusinessAddress,
} from "../twilio/numbers";
import { syncAdditionalNumberQuantity } from "../billing/stripe-number-quantity";
import {
  syncStripeLocalNumberBilling,
  type LocalNumberBillingResult,
} from "../billing/stripe-local-number-billing";
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
  numberType: RequestedNumberType; // 'toll_free' (first included) | 'local' (paid add-on)
  actorProfileId: string | null;
  actorEmail: string | null;
  source: ProvisionSource;
  additionalBillingAuthorized: boolean;
  localBillingAuthorized: boolean;
};

export type ProvisionErrorCode =
  | NumberPurchaseBlockReason
  | "additional_billing_authorization_required"
  | "local_billing_authorization_required"
  | "number_already_assigned"
  | "number_no_longer_available"
  | "purchase_disabled"
  | "missing_fields"
  | "billing_sync_failed"
  | "payment_failed"
  | "reconciliation_required"
  | "purchase_failed";

export type AssignedNumber = {
  id: string;
  phoneNumber: string;
  numberType: RequestedNumberType;
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
  | {
      ok: false;
      error: ProvisionErrorCode;
      message: string;
      attemptId?: string;
      missingFields?: string[];
    };

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
  local_billing_not_configured:
    "Local number billing is not configured yet. No charge was made.",
  local_billing_authorization_required:
    "Authorize local number fees before assigning this number.",
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
  const { clinicId, phoneNumber, numberType, actorProfileId, actorEmail, source } = input;

  // ── 1. Gate + open a durable attempt inside a clinic-row lock ───────────────
  let gate:
    | { kind: "blocked"; error: ProvisionErrorCode; message: string }
    | { kind: "started"; attemptId: string; slotClass: "included" | "additional" };
  try {
    gate = await sql.begin(async (tx) => {
      // Serialize per clinic: a concurrent call blocks here until we commit.
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;

      const ent = await computeNumberEntitlement(tx, clinicId);
      // Type-aware decision: toll-free first = included; additional toll-free =
      // paid; local = always a paid add-on and fail-closed until billing wired.
      const decision = decideTypedPurchase(ent, numberType);
      if (decision.blockReason) {
        return {
          kind: "blocked" as const,
          error: decision.blockReason,
          message: BLOCK_MESSAGES[decision.blockReason],
        };
      }
      // Local must never be assigned as included. Backstop in case the typed
      // decision ever regresses.
      const slotClass: "included" | "additional" =
        decision.billingClass === "included" ? "included" : "additional";
      if (numberType === "local" && slotClass !== "additional") {
        return {
          kind: "blocked" as const,
          error: "local_billing_not_configured" as const,
          message: BLOCK_MESSAGES.local_billing_not_configured,
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

      if (decision.requiresAdditionalConsent && !input.additionalBillingAuthorized) {
        return {
          kind: "blocked" as const,
          error: "additional_billing_authorization_required" as const,
          message:
            "Authorize the additional $20/month charge before purchasing this number.",
        };
      }
      if (decision.requiresLocalBilling && !input.localBillingAuthorized) {
        return {
          kind: "blocked" as const,
          error: "local_billing_authorization_required" as const,
          message: BLOCK_MESSAGES.local_billing_authorization_required,
        };
      }

      try {
        const ins = await tx<{ id: string }[]>`
          insert into public.clinic_phone_number_purchase_attempts
            (clinic_id, requested_phone_number, requested_number_type,
             requested_by_profile_id, requested_by_email, source, slot_class, status)
          values
            (${clinicId}, ${phoneNumber}, ${numberType}, ${actorProfileId},
             ${actorEmail}, ${source}, ${slotClass}, 'started')
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
  const slotClass = gate.slotClass;

  // ── 2. Twilio purchase gate (no transaction held open) ─────────────────────
  const purchaseMode = getTwilioNumberPurchaseMode();
  if (purchaseMode === "disabled") {
    await markAttempt(attemptId, { status: "cancelled", error_code: "purchase_disabled" });
    return {
      ok: false,
      error: "purchase_disabled",
      message: "Number assignment is temporarily unavailable. Please contact support.",
      attemptId,
    };
  }

  // ── 3. Local number billing: charge/sync Stripe BEFORE any Twilio purchase ─
  let localBilling: Extract<LocalNumberBillingResult, { ok: true }> | null = null;
  if (numberType === "local") {
    await markAttempt(attemptId, { status: "billing_pending" });
    const billingRows = await sql<
      {
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        stripe_payment_method_id: string | null;
        billing_status: string;
      }[]
    >`
      select stripe_customer_id, stripe_subscription_id, stripe_payment_method_id, billing_status
      from public.clinics
      where id = ${clinicId}
      limit 1
    `;
    const billing = billingRows[0];
    if (!billing) {
      await markAttempt(attemptId, { status: "failed", error_code: "clinic_not_found" });
      return {
        ok: false,
        error: "purchase_failed",
        message: "Could not verify billing before purchase. Please try again.",
        attemptId,
      };
    }
    const sync = await syncStripeLocalNumberBilling({
      clinicId,
      stripeCustomerId: billing.stripe_customer_id,
      stripeSubscriptionId: billing.stripe_subscription_id,
      stripePaymentMethodId: billing.stripe_payment_method_id,
      billingStatus: billing.billing_status,
      attemptId,
    });
    if (!sync.ok) {
      await markAttempt(attemptId, {
        status: "failed",
        error_code: sync.error,
        error_message: sync.error,
      });
      return { ok: false, error: sync.error, message: sync.message, attemptId };
    }
    localBilling = sync;
  }

  // ── 4. Purchase the Twilio number ──────────────────────────────────────────
  let sid: string;
  let purchasedNumber: string;
  let twilioAddressSid: string | null = null;
  let twilioEmergencyAddressSid: string | null = null;
  let twilioEmergencyAddressStatus: string | null = null;
  // Estimated Twilio monthly-renewal billing anchor stored on the assigned row.
  let twilioPurchasedAt: Date;
  if (purchaseMode === "mock") {
    sid = `PN_mock_${attemptId.replace(/-/g, "")}`;
    purchasedNumber = phoneNumber;
    twilioPurchasedAt = new Date();
    await markAttempt(attemptId, { status: "twilio_purchased", twilio_phone_number_sid: sid });
    logger.info("provisioning.mock_twilio_purchased", {
      clinicId,
      attemptId,
      source,
      slotClass,
      areaCode: phoneAreaCode(purchasedNumber),
    });
  } else {
    // Real purchase path: mode is "live" or "owner_test_live". In
    // "owner_test_live", only clinics on the committed allowlist may make a real
    // Twilio purchase; any other clinic is treated exactly like "disabled" (no
    // Twilio call, clean user-safe copy). "live" allows all eligible clinics.
    if (!isClinicAllowedForLivePurchase(clinicId)) {
      await markAttempt(attemptId, { status: "cancelled", error_code: "purchase_disabled" });
      return {
        ok: false,
        error: "purchase_disabled",
        message: "Number assignment is temporarily unavailable. Please contact support.",
        attemptId,
      };
    }

    let businessAddress: TwilioBusinessAddress;
    try {
      const readiness = await getPurchaseReadiness(clinicId);
      if (!readiness.ok) {
        await markAttempt(attemptId, {
          status: "cancelled",
          error_code: "missing_fields",
          error_message: `missing_fields:${readiness.missingFields.join(",")}`,
        });
        return {
          ok: false,
          error: "missing_fields",
          message: "Complete required business information before assigning a number.",
          attemptId,
          missingFields: readiness.missingFields,
        };
      }
      businessAddress = readiness.businessAddress;
    } catch (err) {
      logger.error("provisioning.readiness_check_failed", {
        clinicId,
        attemptId,
        message: err instanceof Error ? err.message : "unknown",
      });
      await markAttempt(attemptId, { status: "failed", error_code: "readiness_check_failed" });
      return {
        ok: false,
        error: "purchase_failed",
        message: "Could not verify business information before purchase. Please try again.",
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

    try {
      const purchased = await purchaseNumberAndConfigure({
        phoneNumber,
        appBaseUrl,
        businessAddress,
        attachMessagingService: true,
      });
      sid = purchased.sid;
      purchasedNumber = purchased.phoneNumber;
      twilioAddressSid = purchased.addressSid;
      twilioEmergencyAddressSid = purchased.emergencyAddressSid;
      twilioEmergencyAddressStatus = purchased.emergencyAddressStatus;
      // Use Twilio's dateCreated as the billing anchor; fall back to now() only
      // when Twilio returns no usable date.
      twilioPurchasedAt = purchased.twilioPurchasedAt ?? new Date();
      // Persist the SID immediately so a later failure can never hide it.
      await markAttempt(attemptId, { status: "twilio_purchased", twilio_phone_number_sid: sid });
    } catch (err) {
      if (err instanceof PurchaseConfigurationError) {
        await markAttempt(attemptId, {
          status: "reconciliation_required",
          twilio_phone_number_sid: err.sid,
          error_code:
            err.step === "address_configuration"
              ? "twilio_address_configuration_failed"
              : "messaging_service_attach_failed",
          error_message: localBilling ? `local_billing_synced:${err.message}` : err.message,
        });
        return {
          ok: false,
          error: "reconciliation_required",
          message:
            localBilling
              ? "Local billing was completed, but provider configuration did not complete. Our team will finish setup."
              : "The number was purchased but provider configuration did not complete. Our team will finish setup.",
          attemptId,
        };
      }
      if (isNumberNoLongerAvailableError(err)) {
        if (localBilling) {
          await markAttempt(attemptId, {
            status: "reconciliation_required",
            error_code: "number_no_longer_available_after_billing",
            error_message: "local_billing_synced",
          });
          return {
            ok: false,
            error: "reconciliation_required",
            message:
              "Local billing was completed, but that number is no longer available. Our team will reconcile billing before you retry.",
            attemptId,
          };
        }
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
        if (localBilling) {
          await markAttempt(attemptId, {
            status: "reconciliation_required",
            error_code: "purchase_failed_after_billing",
            error_message: "local_billing_synced",
          });
          return {
            ok: false,
            error: "reconciliation_required",
            message:
              "Local billing was completed, but number purchase failed. Our team will reconcile billing before you retry.",
            attemptId,
          };
        }
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
        error_message: localBilling ? "local_billing_synced" : undefined,
      });
      return {
        ok: false,
        error: "reconciliation_required",
        message:
          localBilling
            ? "Local billing was completed, but we could not confirm the number purchase. Our team will reconcile it — please do not retry."
            : "We could not confirm the number purchase. Our team will verify it before any charge — please do not retry.",
        attemptId,
      };
    }
  }

  // ── 5. Additional/local paid number activation ─────────────────────────────
  if (slotClass === "additional") {
    if (numberType === "local") {
      if (!localBilling) {
        await markAttempt(attemptId, {
          status: "reconciliation_required",
          error_code: "billing_sync_failed",
        });
        return {
          ok: false,
          error: "billing_sync_failed",
          message: "Payment could not be completed. No number was assigned.",
          attemptId,
        };
      }
      return assignLocalNumber({
        clinicId,
        attemptId,
        sid,
        purchasedNumber,
        twilioAddressSid,
        twilioEmergencyAddressSid,
        twilioEmergencyAddressStatus,
        twilioPurchasedAt,
        actorProfileId,
        actorEmail,
        source,
        localBilling,
      });
    }
    return assignAdditionalNumber({
      clinicId,
      attemptId,
      sid,
      purchasedNumber,
      numberType,
      twilioAddressSid,
      twilioEmergencyAddressSid,
      twilioEmergencyAddressStatus,
      twilioPurchasedAt,
      actorProfileId,
      actorEmail,
      source,
    });
  }

  // ── 5b. Included (first) number: assign + start trial (no charge) ──────────
  const trialDays = runtimeConfig.billing.trialDaysAfterActivation;
  const twilioAddressConfiguredAt = twilioAddressSid ? new Date() : null;
  try {
    const assigned = await sql.begin(async (tx) => {
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;

      const rows = await tx<
        {
          id: string;
          phone_number: string;
          number_type: string;
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
          (clinic_id, phone_number, number_type, twilio_phone_number_sid, role, is_active,
           source, billing_class, monthly_unit_amount_cents, currency,
           purchased_by_profile_id, purchased_by_email, activated_at,
           twilio_address_sid, twilio_emergency_address_sid,
           twilio_emergency_address_status, twilio_address_configured_at,
           twilio_purchased_at, texting_status, texting_status_source,
           texting_status_updated_at)
        values
          (${clinicId}, ${purchasedNumber}, ${numberType}, ${sid}, 'office_texting', true,
           ${source}, 'included', 0, ${billingConfig.currency},
           ${actorProfileId}, ${actorEmail}, now(),
           ${twilioAddressSid}, ${twilioEmergencyAddressSid},
           ${twilioEmergencyAddressStatus},
           ${twilioAddressConfiguredAt},
           ${twilioPurchasedAt}, 'waiting_for_approval', 'assignment_default',
           now())
        on conflict (phone_number) do update set
          clinic_id = excluded.clinic_id,
          number_type = excluded.number_type,
          twilio_phone_number_sid = excluded.twilio_phone_number_sid,
          role = 'office_texting',
          is_active = true,
          texting_status = 'waiting_for_approval',
          texting_status_source = 'assignment_default',
          texting_status_updated_at = now(),
          texting_provider_status = null,
          texting_provider_error_code = null,
          texting_provider_error_message = null,
          texting_provider_synced_at = null,
          source = excluded.source,
          billing_class = excluded.billing_class,
          monthly_unit_amount_cents = excluded.monthly_unit_amount_cents,
          currency = excluded.currency,
          purchased_by_profile_id = excluded.purchased_by_profile_id,
          purchased_by_email = excluded.purchased_by_email,
          twilio_address_sid = excluded.twilio_address_sid,
          twilio_emergency_address_sid = excluded.twilio_emergency_address_sid,
          twilio_emergency_address_status = excluded.twilio_emergency_address_status,
          twilio_address_configured_at = excluded.twilio_address_configured_at,
          twilio_purchased_at = excluded.twilio_purchased_at,
          activated_at = now(),
          suspended_at = null,
          suspended_by_profile_id = null,
          suspension_reason = null,
          removal_status = 'active',
          removal_requested_at = null,
          removal_requested_by_profile_id = null,
          removal_requested_by_email = null,
          permanent_removal_at = null,
          twilio_release_status = 'not_required',
          twilio_release_error = null
        returning id, phone_number, number_type, role, is_active, billing_class,
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
        numberType: assigned.number_type as RequestedNumberType,
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

// Local number activation. Stripe local billing has already succeeded before
// Twilio purchase. This function only persists the active local mapping and the
// safe Stripe references that fit the existing attempt table.
async function assignLocalNumber(args: {
  clinicId: string;
  attemptId: string;
  sid: string;
  purchasedNumber: string;
  twilioAddressSid: string | null;
  twilioEmergencyAddressSid: string | null;
  twilioEmergencyAddressStatus: string | null;
  twilioPurchasedAt: Date;
  actorProfileId: string | null;
  actorEmail: string | null;
  source: ProvisionSource;
  localBilling: Extract<LocalNumberBillingResult, { ok: true }>;
}): Promise<ProvisionResult> {
  const sql = getDb();
  const {
    clinicId,
    attemptId,
    sid,
    purchasedNumber,
    twilioAddressSid,
    twilioEmergencyAddressSid,
    twilioEmergencyAddressStatus,
    twilioPurchasedAt,
    actorProfileId,
    actorEmail,
    source,
    localBilling,
  } = args;

  const amount = billingConfig.numberModel.local.mcdFees.monthlyNumberCents;
  const twilioAddressConfiguredAt = twilioAddressSid ? new Date() : null;
  const ctxRows = await sql<{ subscription_id: string | null }[]>`
    select stripe_subscription_id as subscription_id
    from public.clinics where id = ${clinicId} limit 1
  `;
  const subscriptionId = ctxRows[0]?.subscription_id ?? null;

  try {
    const assigned = await sql.begin(async (tx) => {
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;
      const rows = await tx<
        {
          id: string;
          phone_number: string;
          number_type: string;
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
          (clinic_id, phone_number, number_type, twilio_phone_number_sid, role, is_active,
           source, billing_class, monthly_unit_amount_cents, currency,
           purchased_by_profile_id, purchased_by_email, activated_at,
           twilio_address_sid, twilio_emergency_address_sid,
           twilio_emergency_address_status, twilio_address_configured_at,
           twilio_purchased_at, texting_status, texting_status_source,
           texting_status_updated_at)
        values
          (${clinicId}, ${purchasedNumber}, 'local', ${sid}, 'office_texting', true,
           ${source}, 'additional', ${amount}, ${billingConfig.currency},
           ${actorProfileId}, ${actorEmail}, now(),
           ${twilioAddressSid}, ${twilioEmergencyAddressSid},
           ${twilioEmergencyAddressStatus},
           ${twilioAddressConfiguredAt},
           ${twilioPurchasedAt}, 'waiting_for_approval', 'assignment_default',
           now())
        on conflict (phone_number) do update set
          clinic_id = excluded.clinic_id,
          number_type = excluded.number_type,
          twilio_phone_number_sid = excluded.twilio_phone_number_sid,
          role = 'office_texting',
          is_active = true,
          texting_status = 'waiting_for_approval',
          texting_status_source = 'assignment_default',
          texting_status_updated_at = now(),
          texting_provider_status = null,
          texting_provider_error_code = null,
          texting_provider_error_message = null,
          texting_provider_synced_at = null,
          source = excluded.source,
          billing_class = excluded.billing_class,
          monthly_unit_amount_cents = excluded.monthly_unit_amount_cents,
          currency = excluded.currency,
          purchased_by_profile_id = excluded.purchased_by_profile_id,
          purchased_by_email = excluded.purchased_by_email,
          twilio_address_sid = excluded.twilio_address_sid,
          twilio_emergency_address_sid = excluded.twilio_emergency_address_sid,
          twilio_emergency_address_status = excluded.twilio_emergency_address_status,
          twilio_address_configured_at = excluded.twilio_address_configured_at,
          twilio_purchased_at = excluded.twilio_purchased_at,
          activated_at = now(),
          suspended_at = null,
          suspended_by_profile_id = null,
          suspension_reason = null,
          removal_status = 'active',
          removal_requested_at = null,
          removal_requested_by_profile_id = null,
          removal_requested_by_email = null,
          permanent_removal_at = null,
          twilio_release_status = 'not_required',
          twilio_release_error = null
        returning id, phone_number, number_type, role, is_active, billing_class,
                  monthly_unit_amount_cents, currency, activated_at, created_at
      `;
      const row = rows[0];
      if (!row) throw new Error("clinic_phone_numbers insert returned no row");

      await tx`
        update public.clinics set local_number_status = 'assigned'
        where id = ${clinicId}
      `;

      await tx`
        update public.clinic_phone_number_purchase_attempts set
          status = 'assigned',
          stripe_subscription_id = ${subscriptionId},
          error_message = ${`local_billing_invoice:${localBilling.oneTimeInvoiceId}:${localBilling.oneTimeInvoiceStatus ?? "unknown"}`}
        where id = ${attemptId}
      `;
      return row;
    });

    logger.info("provisioning.assigned", {
      clinicId,
      attemptId,
      source,
      slotClass: "additional",
      numberType: "local",
      areaCode: phoneAreaCode(purchasedNumber),
    });

    return {
      ok: true,
      attemptId,
      twilioSid: sid,
      assigned: {
        id: assigned.id,
        phoneNumber: assigned.phone_number,
        numberType: assigned.number_type as RequestedNumberType,
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
    logger.error("provisioning.local_assignment_save_failed", {
      clinicId,
      attemptId,
      message: err instanceof Error ? err.message : "unknown",
    });
    await markAttempt(attemptId, {
      status: "reconciliation_required",
      error_code: "assignment_save_failed",
      error_message: `local_billing_invoice:${localBilling.oneTimeInvoiceId}:${localBilling.oneTimeInvoiceStatus ?? "unknown"}`,
    });
    return {
      ok: false,
      error: "reconciliation_required",
      message:
        "The number was purchased and local billing updated, but it could not be activated automatically. Our team will finish setup.",
      attemptId,
    };
  }
}

// Additional (paid) number activation. The Twilio number is already purchased
// (SID persisted on the attempt). We sync the Stripe additional-number quantity
// FIRST and only insert the active mapping if the sync succeeds. On any failure
// the attempt is marked reconciliation_required and the number is NEVER released.
async function assignAdditionalNumber(args: {
  clinicId: string;
  attemptId: string;
  sid: string;
  purchasedNumber: string;
  numberType: RequestedNumberType;
  twilioAddressSid: string | null;
  twilioEmergencyAddressSid: string | null;
  twilioEmergencyAddressStatus: string | null;
  twilioPurchasedAt: Date;
  actorProfileId: string | null;
  actorEmail: string | null;
  source: ProvisionSource;
}): Promise<ProvisionResult> {
  const sql = getDb();
  const {
    clinicId,
    attemptId,
    sid,
    purchasedNumber,
    numberType,
    twilioAddressSid,
    twilioEmergencyAddressSid,
    twilioEmergencyAddressStatus,
    twilioPurchasedAt,
    actorProfileId,
    actorEmail,
    source,
  } = args;

  await markAttempt(attemptId, { status: "billing_pending" });

  // Re-read billing context. The in-flight attempt blocks concurrent additional
  // purchases, so this count is stable. Suspended additional numbers are counted
  // (billing_class='additional' regardless of is_active) — quantity never drops
  // on suspension.
  const ctxRows = await sql<
    { subscription_id: string | null; additional_item_id: string | null; additional_count: number }[]
  >`
    select
      stripe_subscription_id as subscription_id,
      stripe_additional_number_subscription_item_id as additional_item_id,
      (select count(*)::int from public.clinic_phone_numbers
         where clinic_id = ${clinicId}
           and billing_class = 'additional'
           and removal_status <> 'permanently_removed') as additional_count
    from public.clinics where id = ${clinicId} limit 1
  `;
  const subscriptionId = ctxRows[0]?.subscription_id ?? null;
  const additionalCountBefore = ctxRows[0]?.additional_count ?? 0;
  if (!subscriptionId) {
    logger.error("provisioning.additional_no_subscription", { clinicId, attemptId });
    await markAttempt(attemptId, {
      status: "reconciliation_required",
      error_code: "no_active_subscription",
    });
    return {
      ok: false,
      error: "reconciliation_required",
      message: "The number was purchased but billing could not be synchronized. Our team will verify it.",
      attemptId,
    };
  }

  const desiredQuantity = additionalCountBefore + 1;
  const sync = await syncAdditionalNumberQuantity({
    clinicId,
    stripeSubscriptionId: subscriptionId,
    existingAdditionalItemId: ctxRows[0]?.additional_item_id ?? null,
    desiredQuantity,
    attemptId,
  });
  if (!sync.ok) {
    // Twilio number purchased + SID persisted, but billing not synced. Do NOT
    // activate and do NOT release the number.
    await markAttempt(attemptId, { status: "reconciliation_required", error_code: sync.error });
    return { ok: false, error: sync.error, message: sync.message, attemptId };
  }

  const amount = billingConfig.additionalBusinessNumber.monthlyUnitAmountCents;
  const twilioAddressConfiguredAt = twilioAddressSid ? new Date() : null;
  try {
    const assigned = await sql.begin(async (tx) => {
      await tx`select 1 from public.clinics where id = ${clinicId} for update`;
      const rows = await tx<
        {
          id: string;
          phone_number: string;
          number_type: string;
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
          (clinic_id, phone_number, number_type, twilio_phone_number_sid, role, is_active,
           source, billing_class, monthly_unit_amount_cents, currency,
           purchased_by_profile_id, purchased_by_email, activated_at,
           twilio_address_sid, twilio_emergency_address_sid,
           twilio_emergency_address_status, twilio_address_configured_at,
           twilio_purchased_at, texting_status, texting_status_source,
           texting_status_updated_at)
        values
          (${clinicId}, ${purchasedNumber}, ${numberType}, ${sid}, 'office_texting', true,
           ${source}, 'additional', ${amount}, ${billingConfig.currency},
           ${actorProfileId}, ${actorEmail}, now(),
           ${twilioAddressSid}, ${twilioEmergencyAddressSid},
           ${twilioEmergencyAddressStatus},
           ${twilioAddressConfiguredAt},
           ${twilioPurchasedAt}, 'waiting_for_approval', 'assignment_default',
           now())
        on conflict (phone_number) do update set
          clinic_id = excluded.clinic_id,
          number_type = excluded.number_type,
          twilio_phone_number_sid = excluded.twilio_phone_number_sid,
          role = 'office_texting',
          is_active = true,
          texting_status = 'waiting_for_approval',
          texting_status_source = 'assignment_default',
          texting_status_updated_at = now(),
          texting_provider_status = null,
          texting_provider_error_code = null,
          texting_provider_error_message = null,
          texting_provider_synced_at = null,
          source = excluded.source,
          billing_class = excluded.billing_class,
          monthly_unit_amount_cents = excluded.monthly_unit_amount_cents,
          currency = excluded.currency,
          purchased_by_profile_id = excluded.purchased_by_profile_id,
          purchased_by_email = excluded.purchased_by_email,
          twilio_address_sid = excluded.twilio_address_sid,
          twilio_emergency_address_sid = excluded.twilio_emergency_address_sid,
          twilio_emergency_address_status = excluded.twilio_emergency_address_status,
          twilio_address_configured_at = excluded.twilio_address_configured_at,
          twilio_purchased_at = excluded.twilio_purchased_at,
          activated_at = now(),
          suspended_at = null,
          suspended_by_profile_id = null,
          suspension_reason = null,
          removal_status = 'active',
          removal_requested_at = null,
          removal_requested_by_profile_id = null,
          removal_requested_by_email = null,
          permanent_removal_at = null,
          twilio_release_status = 'not_required',
          twilio_release_error = null
        returning id, phone_number, number_type, role, is_active, billing_class,
                  monthly_unit_amount_cents, currency, activated_at, created_at
      `;
      const row = rows[0];
      if (!row) throw new Error("clinic_phone_numbers insert returned no row");

      await tx`
        update public.clinic_phone_number_purchase_attempts set
          status = 'assigned',
          stripe_subscription_id = ${subscriptionId},
          stripe_additional_quantity_before = ${additionalCountBefore},
          stripe_additional_quantity_after = ${desiredQuantity}
        where id = ${attemptId}
      `;
      return row;
    });

    logger.info("provisioning.assigned", {
      clinicId,
      attemptId,
      source,
      slotClass: "additional",
      areaCode: phoneAreaCode(purchasedNumber),
    });

    return {
      ok: true,
      attemptId,
      twilioSid: sid,
      assigned: {
        id: assigned.id,
        phoneNumber: assigned.phone_number,
        numberType: assigned.number_type as RequestedNumberType,
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
    // Twilio purchased + Stripe quantity already incremented, but the mapping
    // insert failed. Never release; never auto-reduce quantity. Reconcile.
    logger.error("provisioning.additional_assignment_save_failed", {
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
        "The number was purchased and billing updated, but it could not be activated automatically. Our team will finish setup.",
      attemptId,
    };
  }
}

type PurchaseReadinessRow = {
  name: string | null;
  legal_business_name: string | null;
  main_phone: string | null;
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  business_info_completed: boolean;
};

type PurchaseReadinessResult =
  | { ok: true; businessAddress: TwilioBusinessAddress }
  | { ok: false; missingFields: string[] };

async function getPurchaseReadiness(
  clinicId: string,
): Promise<PurchaseReadinessResult> {
  const sql = getDb();
  const rows = await sql<PurchaseReadinessRow[]>`
    select
      name,
      legal_business_name,
      main_phone,
      street_address,
      address_line2,
      city,
      state_region,
      postal_code,
      country,
      business_info_completed
    from public.clinics
    where id = ${clinicId}
    limit 1
  `;
  const clinic = rows[0];
  if (!clinic) throw new Error("clinic not found for purchase readiness");

  const missingFields: string[] = [];
  if (!present(clinic.name)) missingFields.push("name");
  if (!present(clinic.legal_business_name)) missingFields.push("legal_business_name");
  if (!present(clinic.main_phone)) missingFields.push("main_phone");
  if (!present(clinic.street_address)) missingFields.push("street_address");
  if (!present(clinic.city)) missingFields.push("city");
  if (!present(clinic.state_region)) missingFields.push("state_region");
  if (!present(clinic.postal_code)) missingFields.push("postal_code");
  if (clinic.country !== "US") missingFields.push("country");
  if (clinic.business_info_completed !== true) missingFields.push("business_info_completed");

  if (missingFields.length > 0) {
    return { ok: false, missingFields };
  }

  return {
    ok: true,
    businessAddress: {
      clinicId,
      customerName: clinic.legal_business_name!.trim(),
      street: clinic.street_address!.trim(),
      streetSecondary: present(clinic.address_line2) ? clinic.address_line2!.trim() : null,
      city: clinic.city!.trim(),
      region: clinic.state_region!.trim(),
      postalCode: clinic.postal_code!.trim(),
      isoCountry: "US",
    },
  };
}

function present(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
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
