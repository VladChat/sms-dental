import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  reactivateClinicPhoneNumber,
  suspendClinicPhoneNumber,
} from "@/lib/db/admin/actions";
import { detachClinicPhoneNumber } from "@/lib/phone-numbers/detach-number";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { tailSid } from "@/lib/db/admin/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const BodySchema = z.object({
  action: z.enum(["suspend", "reactivate", "detach"]),
  reason: z.union([z.string(), z.null()]).optional(),
});

// POST /api/admin/clinics/[clinicId]/phone-numbers/[phoneNumberId]/action
//
// Platform-admin-only per-number control. SUSPEND keeps the Twilio number and the
// clinic_phone_numbers row (is_active=false) — it does NOT release the number or
// change Stripe additional-number quantity, so a suspended number still counts
// toward the limit and remains billed. REACTIVATE flips is_active back to true.
// DETACH releases ONLY the clinic assignment (removal_status='detached'); it keeps
// the Twilio number in our account (no release), does not touch Stripe or the
// Messaging Service, and makes the number available to assign to another clinic.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string; phoneNumberId: string }> },
): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId, phoneNumberId } = await ctx.params;
  if (!UUID_RE.test(clinicId) || !UUID_RE.test(phoneNumberId)) {
    return jsonError(404, "not_found", "Number not found.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Unknown or invalid action.");
  }

  try {
    if (parsed.data.action === "suspend") {
      const reason = (parsed.data.reason ?? "").trim() || null;
      const res = await suspendClinicPhoneNumber(clinicId, phoneNumberId, admin.userId, reason);
      if (!res) return jsonError(404, "not_found", "Number not found for this clinic.");
      await audit(admin, clinicId, "clinic.phone_number.suspend", {
        phone_number: res.phoneNumber,
        is_active: res.isActive,
      });
      return jsonOk({ ok: true, message: "Number suspended." });
    }

    if (parsed.data.action === "detach") {
      const res = await detachClinicPhoneNumber({
        clinicId,
        phoneNumberId,
        actorProfileId: admin.userId,
        actorEmail: admin.email,
      });
      if (!res.ok) {
        if (res.error === "not_found") {
          return jsonError(404, "not_found", res.message);
        }
        return jsonError(409, res.error, res.message);
      }
      await audit(
        admin,
        clinicId,
        "clinic.phone_number.detach",
        {
          phone_number: res.phoneNumber,
          removal_status: "detached",
          is_active: false,
          twilio_release_status: "not_required",
          twilio_sid_tail: tailSid(res.twilioSid),
        },
        { previous_removal_status: res.previousStatus },
      );
      return jsonOk({ ok: true, message: "Number detached from this clinic." });
    }

    const res = await reactivateClinicPhoneNumber(clinicId, phoneNumberId);
    if (!res) return jsonError(404, "not_found", "Number not found for this clinic.");
    await audit(admin, clinicId, "clinic.phone_number.reactivate", {
      phone_number: res.phoneNumber,
      is_active: res.isActive,
    });
    return jsonOk({ ok: true, message: "Number reactivated." });
  } catch {
    return jsonError(500, "action_failed", "Could not complete this action. Please try again.");
  }
}

async function audit(
  admin: { userId: string | null; email: string; source: string },
  clinicId: string,
  action: string,
  after: Record<string, string | number | boolean | null>,
  extraMetadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action,
      targetType: "clinic_phone_number",
      targetId: clinicId,
      clinicId,
      afterState: after,
      metadata: { authSource: admin.source, ...extraMetadata },
    });
  } catch {
    // Mutation already succeeded; never fail on an audit hiccup.
  }
}
