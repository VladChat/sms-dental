import { getDb } from "./client";
import {
  additionalNumberConsentText,
  billingConfig,
} from "../../config/billing.config";

// Owner-requested phone numbers. A request is an owner preference + pricing/consent
// snapshot only — the platform admin reviews it and finishes assignment through
// the existing admin-only purchase flow. Nothing here touches Twilio,
// clinic_phone_numbers, local_number_status, or sms_recovery_enabled, and no
// charge starts at request time (billing is revalidated at activation later).

export type ClinicNumberRequestStatus =
  | "pending"
  | "reviewed"
  | "fulfilled"
  | "rejected"
  | "cancelled";

// Open = still awaiting the operator (counts toward number slots / dedupe).
export const OPEN_REQUEST_STATUSES = ["pending", "reviewed"] as const;

export type ClinicNumberRequestRow = {
  id: string;
  clinic_id: string;
  requested_phone_number: string;
  friendly_name: string | null;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  number_type: string;
  capabilities: Record<string, boolean> | null;
  status: ClinicNumberRequestStatus;
  requested_by_profile_id: string | null;
  requested_by_email: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by_profile_id: string | null;
  admin_note: string | null;
  // Billing snapshot (recorded at request time; revalidated at activation later).
  billing_class: "included" | "additional";
  monthly_unit_amount_cents: number;
  currency: string;
  billing_consent_text_version: string | null;
  billing_consent_text: string | null;
  billing_consent_authorized_at: Date | null;
  billing_consent_authorized_by_profile_id: string | null;
  billing_consent_authorized_by_email: string | null;
};

const REQUEST_COLS = [
  "id", "clinic_id", "requested_phone_number", "friendly_name", "locality",
  "region", "postal_code", "number_type", "capabilities", "status",
  "requested_by_profile_id", "requested_by_email", "created_at", "updated_at",
  "reviewed_at", "reviewed_by_profile_id", "admin_note",
  "billing_class", "monthly_unit_amount_cents", "currency",
  "billing_consent_text_version", "billing_consent_text",
  "billing_consent_authorized_at", "billing_consent_authorized_by_profile_id",
  "billing_consent_authorized_by_email",
] as const;

export type CreateClinicNumberRequestInput = {
  clinicId: string;
  requestedPhoneNumber: string;
  friendlyName?: string | null;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  numberType?: "local" | "toll_free";
  capabilities?: Record<string, boolean>;
  requestedByProfileId?: string | null;
  requestedByEmail?: string | null;
  // Client-supplied authorization flag ONLY. The server decides whether consent
  // is required (additional number) and what the price/consent text are.
  additionalBillingAuthorized?: boolean;
};

export type CreateClinicNumberRequestResult =
  | { ok: true; row: ClinicNumberRequestRow; deduped: boolean }
  | { ok: false; reason: "additional_billing_authorization_required" }
  | { ok: false; reason: "already_assigned_to_clinic" };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Record an owner's requested number as an open ('pending') request, classifying
 * its billing on the SERVER from current DB state. Runs in a transaction that
 * locks the clinic row so the included-vs-additional decision is race-safe.
 *
 * - Does NOT supersede/cancel other different open requests (multiple different
 *   open numbers may coexist).
 * - Idempotent: an existing open request for the same clinic + same number is
 *   returned unchanged (no duplicate row).
 * - Classification: if (active assigned numbers + open requests) <
 *   billingConfig.basePlan.includedBusinessNumbers -> 'included' (amount 0, no
 *   consent). Otherwise -> 'additional' (amount from config, consent required).
 * - No Twilio call, no clinic_phone_numbers write, no sms_recovery change, no
 *   charge. Consent is stored as a durable audit snapshot.
 */
export async function createClinicNumberRequest(
  input: CreateClinicNumberRequestInput,
): Promise<CreateClinicNumberRequestResult> {
  const sql = getDb();
  const clinicId = input.clinicId;
  const phone = input.requestedPhoneNumber;

  return sql.begin(async (tx) => {
    // Serialize per-clinic so concurrent requests classify against a stable count.
    await tx`select 1 from public.clinics where id = ${clinicId} for update`;

    // The phone is already an active assigned number on this clinic — nothing to
    // request. (A purchased number must never be re-requested/replaced.)
    const assignedSame = await tx<{ one: number }[]>`
      select 1 as one from public.clinic_phone_numbers
      where clinic_id = ${clinicId} and phone_number = ${phone} and is_active = true
      limit 1
    `;
    if (assignedSame.length > 0) {
      return { ok: false, reason: "already_assigned_to_clinic" } as const;
    }

    // Idempotency: same clinic + same number already open -> return it.
    const existingOpen = await tx<ClinicNumberRequestRow[]>`
      select ${tx(REQUEST_COLS as unknown as string[])}
      from public.clinic_number_requests
      where clinic_id = ${clinicId} and requested_phone_number = ${phone}
        and status in ('pending', 'reviewed')
      order by created_at desc
      limit 1
    `;
    if (existingOpen[0]) {
      return { ok: true, row: existingOpen[0], deduped: true } as const;
    }

    const assignedCount = await tx<{ n: number }[]>`
      select count(*)::int as n from public.clinic_phone_numbers
      where clinic_id = ${clinicId} and is_active = true
    `;
    const openCount = await tx<{ n: number }[]>`
      select count(*)::int as n from public.clinic_number_requests
      where clinic_id = ${clinicId} and status in ('pending', 'reviewed')
    `;
    const usedSlots = (assignedCount[0]?.n ?? 0) + (openCount[0]?.n ?? 0);
    const isIncluded = usedSlots < billingConfig.basePlan.includedBusinessNumbers;

    if (!isIncluded && !input.additionalBillingAuthorized) {
      return { ok: false, reason: "additional_billing_authorization_required" } as const;
    }

    const billingClass = isIncluded ? "included" : "additional";
    const monthlyAmount = isIncluded
      ? 0
      : billingConfig.additionalBusinessNumber.monthlyUnitAmountCents;
    const currency = billingConfig.currency;
    const consentVersion = isIncluded
      ? null
      : billingConfig.additionalBusinessNumber.consentTextVersion;
    const consentText = isIncluded ? null : additionalNumberConsentText();
    const consentAt = isIncluded ? null : new Date();
    const consentProfile = isIncluded ? null : input.requestedByProfileId ?? null;
    const consentEmail = isIncluded ? null : input.requestedByEmail ?? null;

    const capabilitiesJson = JSON.stringify(input.capabilities ?? {});
    try {
      const rows = await tx<ClinicNumberRequestRow[]>`
        insert into public.clinic_number_requests
          (clinic_id, requested_phone_number, friendly_name, locality, region,
           postal_code, number_type, capabilities, requested_by_profile_id,
           requested_by_email, billing_class, monthly_unit_amount_cents, currency,
           billing_consent_text_version, billing_consent_text,
           billing_consent_authorized_at, billing_consent_authorized_by_profile_id,
           billing_consent_authorized_by_email)
        values
          (${clinicId}, ${phone}, ${input.friendlyName ?? null}, ${input.locality ?? null},
           ${input.region ?? null}, ${input.postalCode ?? null}, ${input.numberType ?? "local"},
           ${capabilitiesJson}::jsonb, ${input.requestedByProfileId ?? null},
           ${input.requestedByEmail ?? null}, ${billingClass}, ${monthlyAmount}, ${currency},
           ${consentVersion}, ${consentText}, ${consentAt}, ${consentProfile}, ${consentEmail})
        returning ${tx(REQUEST_COLS as unknown as string[])}
      `;
      const row = rows[0];
      if (!row) throw new Error("clinic number request insert returned no row");
      return { ok: true, row, deduped: false } as const;
    } catch (err) {
      // Partial-unique backstop on (clinic_id, phone) for open statuses.
      if (isUniqueViolation(err)) {
        const again = await tx<ClinicNumberRequestRow[]>`
          select ${tx(REQUEST_COLS as unknown as string[])}
          from public.clinic_number_requests
          where clinic_id = ${clinicId} and requested_phone_number = ${phone}
            and status in ('pending', 'reviewed')
          order by created_at desc
          limit 1
        `;
        if (again[0]) return { ok: true, row: again[0], deduped: true } as const;
      }
      throw err;
    }
  });
}

// All OPEN (pending/reviewed) requests for a clinic, oldest first.
export async function listOpenClinicNumberRequestsForClinic(
  clinicId: string,
): Promise<ClinicNumberRequestRow[]> {
  const sql = getDb();
  return sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${clinicId} and status in ('pending', 'reviewed')
    order by created_at asc
  `;
}

export async function countOpenClinicNumberRequestsForClinic(
  clinicId: string,
): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.clinic_number_requests
    where clinic_id = ${clinicId} and status in ('pending', 'reviewed')
  `;
  return rows[0]?.n ?? 0;
}

// Recent requests (any status) for a clinic — admin history view.
export async function listRecentClinicNumberRequestsForClinic(
  clinicId: string,
  limit = 10,
): Promise<ClinicNumberRequestRow[]> {
  const sql = getDb();
  return sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${clinicId}
    order by created_at desc
    limit ${limit}
  `;
}

// Latest request (any status) for a clinic. Retained for back-compat callers.
export async function findLatestClinicNumberRequest(
  clinicId: string,
): Promise<ClinicNumberRequestRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${clinicId}
    order by created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}
