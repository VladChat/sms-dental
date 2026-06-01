import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../lib/auth/platform-admin";
import { getAdminClinicDetail } from "../../../../../../lib/db/admin/clinics";
import {
  setAdminInternalNote,
  setClinicActive,
  setSmsRecoveryEnabled,
  type ActionResult,
} from "../../../../../../lib/db/admin/actions";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const NOTE_MAX = 1000;

// Working admin actions only. `deactivate`/`reactivate` are the clinic status
// control (clinics.is_active). `enable_sms`/`disable_sms` back the single
// service-launch control (clinics.sms_recovery_enabled): `enable_sms` = launch,
// `disable_sms` = pause sending. Provisioning review was removed from the
// product; the columns remain but are no longer settable from here.
const BodySchema = z.object({
  action: z.enum([
    "deactivate",
    "reactivate",
    "disable_sms",
    "enable_sms",
    "update_note",
  ]),
  note: z.union([z.string(), z.null()]).optional(),
});

// POST /api/admin/clinics/[clinicId]/action
// Platform-admin-only. Every successful mutation writes an admin_audit_event.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId } = await ctx.params;
  if (!UUID_RE.test(clinicId)) {
    return jsonError(404, "not_found", "Clinic not found.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Unknown or invalid admin action.");
  }
  const { action } = parsed.data;

  let result: ActionResult = null;
  let auditAction = "";

  try {
    if (action === "deactivate") {
      auditAction = "clinic.deactivate";
      result = await setClinicActive(clinicId, false);
    } else if (action === "reactivate") {
      auditAction = "clinic.reactivate";
      result = await setClinicActive(clinicId, true);
    } else if (action === "disable_sms") {
      auditAction = "clinic.sms_recovery.disable";
      result = await setSmsRecoveryEnabled(clinicId, false);
    } else if (action === "enable_sms") {
      // "Launch service": flips the per-clinic SMS recovery gate on. This never
      // sends SMS by itself (the send path also requires SMS_RECOVERY_MODE=live
      // and respects opt-outs); we still gate it on real readiness so it is not
      // launched prematurely. These three preconditions are the canonical launch
      // gate — the clinic detail UI mirrors them exactly.
      auditAction = "clinic.sms_recovery.enable";
      const detail = await getAdminClinicDetail(clinicId);
      if (!detail) return jsonError(404, "not_found", "Clinic not found.");
      if (!detail.isActive) {
        return jsonError(409, "precondition_failed", "Clinic is paused. Reactivate it before launching service.");
      }
      if (!detail.hasAssignedNumber) {
        return jsonError(409, "precondition_failed", "No phone number assigned. Assign a number before launching.");
      }
      if (!detail.a2pInfoCompleted) {
        return jsonError(409, "precondition_failed", "SMS approval information is not complete yet.");
      }
      result = await setSmsRecoveryEnabled(clinicId, true);
    } else if (action === "update_note") {
      auditAction = "clinic.note.update";
      const trimmed = (parsed.data.note ?? "").trim();
      if (trimmed.length > NOTE_MAX) {
        return jsonBadRequest(`Note must be ${NOTE_MAX} characters or less.`);
      }
      result = await setAdminInternalNote(clinicId, trimmed.length > 0 ? trimmed : null);
    }
  } catch {
    return jsonError(500, "action_failed", "Could not complete this action. Please try again.");
  }

  if (!result) {
    return jsonError(404, "not_found", "Clinic not found.");
  }

  // Redacted before/after: only the fields relevant to this action.
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: auditAction,
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      beforeState: redactSnapshot(action, result.before),
      afterState: redactSnapshot(action, result.after),
      metadata: { authSource: admin.source },
    });
  } catch {
    // The mutation already succeeded; do not fail the request if audit insert
    // hiccups. (Audit-write failures are rare and the action is idempotent.)
  }

  return jsonOk({ ok: true, message: "Done.", after: result.after });
}

function redactSnapshot(
  action: string,
  s: { is_active: boolean; sms_recovery_enabled: boolean; admin_internal_note: string | null },
): Record<string, string | number | boolean | null> {
  if (action === "deactivate" || action === "reactivate") return { is_active: s.is_active };
  if (action === "disable_sms" || action === "enable_sms") return { sms_recovery_enabled: s.sms_recovery_enabled };
  if (action === "update_note") return { admin_internal_note_present: Boolean(s.admin_internal_note) };
  return {};
}
