import { getDb } from "../db/client";
import { logger } from "../logging/logger";
import { classifyNumberType, classifyDetachEligibility } from "./twilio-number-inventory";

// Platform-admin workflow: DETACH an assigned Twilio number from its clinic.
//
// Detach releases ONLY the clinic assignment. It does NOT release the Twilio
// number, does NOT touch Stripe, and does NOT change Messaging Service
// membership. The row stays in clinic_phone_numbers (preserving the SID,
// twilio_purchased_at, and history) with removal_status='detached', so it is
// filtered out of the old clinic's lists/counts and becomes available again in
// the "Assign existing Twilio number" inventory for another clinic.
//
// First version supports only an unpaid, currently-assigned toll-free number
// (the clinic's included/legacy slot, $0). Local and paid/additional numbers are
// blocked here. Number type / billing class are re-read from the DB; the client
// never supplies them.

export type DetachErrorCode =
  | "not_found"
  | "already_detached"
  | "scheduled"
  | "permanently_removed"
  | "local_not_supported"
  | "paid_not_supported"
  | "detach_failed";

export type DetachResult =
  | {
      ok: true;
      phoneNumber: string;
      twilioSid: string | null;
      previousStatus: string;
    }
  | { ok: false; error: DetachErrorCode; message: string };

const MESSAGES: Record<DetachErrorCode, string> = {
  not_found: "Number not found for this clinic.",
  already_detached: "This number is already detached.",
  scheduled: "This number is scheduled for removal and can't be detached.",
  permanently_removed: "This number was permanently removed and can't be detached.",
  local_not_supported: "Local numbers can't be detached from this tool yet.",
  paid_not_supported: "Paid / additional numbers can't be detached from this tool yet.",
  detach_failed: "Could not detach this number safely. Please try again.",
};

function err(code: DetachErrorCode): Extract<DetachResult, { ok: false }> {
  return { ok: false, error: code, message: MESSAGES[code] };
}

type DetachTargetRow = {
  id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
  number_type: "toll_free" | "local";
  billing_class: string;
  monthly_unit_amount_cents: number;
  removal_status: string;
};

export async function detachClinicPhoneNumber(args: {
  clinicId: string;
  phoneNumberId: string;
  actorProfileId: string | null;
  actorEmail: string | null;
}): Promise<DetachResult> {
  const sql = getDb();

  try {
    return await sql.begin(async (tx) => {
      // Serialize per clinic; re-check ownership + state inside the lock.
      const clinic = await tx<{ id: string }[]>`
        select id from public.clinics where id = ${args.clinicId} for update
      `;
      if (clinic.length === 0) return err("not_found");

      const rows = await tx<DetachTargetRow[]>`
        select id, phone_number, twilio_phone_number_sid, number_type,
               billing_class, monthly_unit_amount_cents, removal_status
        from public.clinic_phone_numbers
        where id = ${args.phoneNumberId} and clinic_id = ${args.clinicId}
        for update
        limit 1
      `;
      const target = rows[0];
      if (!target) return err("not_found");

      // Re-classify number type server-side from the stored E.164, never trusting
      // the client or the stored column.
      const numberType = classifyNumberType(target.phone_number);
      const eligibility = classifyDetachEligibility({
        numberType,
        billingClass: target.billing_class,
        monthlyUnitAmountCents: target.monthly_unit_amount_cents,
        removalStatus: target.removal_status,
      });
      if (!eligibility.eligible) {
        if (target.removal_status === "detached") return err("already_detached");
        if (target.removal_status === "scheduled") return err("scheduled");
        if (target.removal_status === "permanently_removed") return err("permanently_removed");
        if (numberType === "local") return err("local_not_supported");
        return err("paid_not_supported");
      }

      const updated = await tx<{ phone_number: string; twilio_phone_number_sid: string | null }[]>`
        update public.clinic_phone_numbers set
          is_active = false,
          removal_status = 'detached',
          permanent_removal_at = null,
          twilio_release_status = 'not_required',
          twilio_released_at = null,
          twilio_release_error = null,
          removal_requested_at = null,
          removal_requested_by_profile_id = null,
          removal_requested_by_email = null,
          suspended_at = null,
          suspended_by_profile_id = null,
          suspension_reason = null
        where id = ${target.id} and clinic_id = ${args.clinicId}
        returning phone_number, twilio_phone_number_sid
      `;
      if (!updated[0]) throw new Error("detach update returned no row");

      return {
        ok: true as const,
        phoneNumber: updated[0].phone_number,
        twilioSid: updated[0].twilio_phone_number_sid,
        previousStatus: target.removal_status,
      };
    });
  } catch (e) {
    logger.error("admin.detach_number.failed", {
      clinicId: args.clinicId,
      phoneNumberId: args.phoneNumberId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return err("detach_failed");
  }
}
