import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../lib/auth/platform-admin";
import { findClinicById, updateA2pInformation } from "../../../../../../lib/db/clinics";
import { isValidE164, normalizePhone } from "../../../../../../lib/phone/normalize";
import { BUSINESS_TYPES } from "../../../../../../lib/validation/url";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Same field set + validation as the owner endpoint (`/api/account/a2p`).
const A2pSchema = z.object({
  legal_business_name: z.string().trim().min(2).max(200),
  ein_tax_id: z.string().trim().min(2).max(40),
  business_type: z.enum(BUSINESS_TYPES),
  rep_first_name: z.string().trim().min(1).max(80),
  rep_last_name: z.string().trim().min(1).max(80),
  rep_email: z.string().trim().email().max(254),
  rep_phone: z.string().trim().min(7).max(40),
  authorized: z.boolean(),
});

// POST /api/admin/clinics/[clinicId]/a2p
//
// Platform-admin-scoped A2P / SMS-approval edit for a single clinic. Mirrors the
// owner save (same columns via updateA2pInformation) but is platform-admin guarded
// and writes an admin_audit_event. Never submits anything to a carrier.
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
  const parsed = A2pSchema.safeParse(body);
  if (!parsed.success) {
    const typeIssue = parsed.error.issues.find((i) => i.path.includes("business_type"));
    if (typeIssue) return jsonBadRequest("Please choose a business type.");
    return jsonBadRequest("Please complete all required approval fields.");
  }
  if (!parsed.data.authorized) {
    return jsonBadRequest(
      "Please confirm the information is accurate and authorize SMS approval for this business.",
    );
  }

  const repPhone = normalizePhone(parsed.data.rep_phone);
  if (!isValidE164(repPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for the representative.");
  }

  const current = await findClinicById(clinicId).catch(() => null);
  if (!current) return jsonError(404, "not_found", "Clinic not found.");

  const next: Record<string, string | boolean | null> = {
    legal_business_name: parsed.data.legal_business_name,
    ein_tax_id: parsed.data.ein_tax_id,
    business_type: parsed.data.business_type,
    a2p_rep_first_name: parsed.data.rep_first_name,
    a2p_rep_last_name: parsed.data.rep_last_name,
    a2p_rep_email: parsed.data.rep_email,
    a2p_rep_phone: repPhone,
    a2p_authorized: parsed.data.authorized,
  };
  const before: Record<string, string | boolean | null> = {
    legal_business_name: current.legal_business_name,
    ein_tax_id: current.ein_tax_id,
    business_type: current.business_type,
    a2p_rep_first_name: current.a2p_rep_first_name,
    a2p_rep_last_name: current.a2p_rep_last_name,
    a2p_rep_email: current.a2p_rep_email,
    a2p_rep_phone: current.a2p_rep_phone,
    a2p_authorized: current.a2p_authorized,
  };
  const changed = Object.keys(next).filter((k) => next[k] !== before[k]);
  if (changed.length === 0 && current.a2p_info_completed) {
    return jsonOk({
      ok: true,
      noop: true,
      clinic_id: clinicId,
      sms_status: current.sms_status,
      smsApproval: echoA2p(current),
    });
  }

  let clinic;
  try {
    clinic = await updateA2pInformation(clinicId, {
      legalBusinessName: parsed.data.legal_business_name,
      einTaxId: parsed.data.ein_tax_id,
      businessType: parsed.data.business_type,
      repFirstName: parsed.data.rep_first_name,
      repLastName: parsed.data.rep_last_name,
      repEmail: parsed.data.rep_email,
      repPhone,
      authorized: parsed.data.authorized,
    });
  } catch {
    return jsonError(500, "save_failed", "Could not save the approval information. Please try again.");
  }

  // Audit: field NAMES only (EIN/phone/email values are never stored in metadata).
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.a2p.update",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      beforeState: {
        a2p_info_completed: current.a2p_info_completed,
        a2p_authorized: current.a2p_authorized,
      },
      afterState: {
        a2p_info_completed: clinic.a2p_info_completed,
        a2p_authorized: clinic.a2p_authorized,
        sms_status: clinic.sms_status,
        changed_fields: changed.join(",") || "none",
      },
      metadata: { authSource: admin.source },
    });
  } catch {
    // Mutation already succeeded; never fail the request on an audit hiccup.
  }

  return jsonOk({
    ok: true,
    clinic_id: clinic.id,
    sms_status: clinic.sms_status,
    smsApproval: echoA2p(clinic),
  });
}

function echoA2p(c: {
  legal_business_name: string | null;
  ein_tax_id: string | null;
  business_type: string | null;
  a2p_rep_first_name: string | null;
  a2p_rep_last_name: string | null;
  a2p_rep_email: string | null;
  a2p_rep_phone: string | null;
  a2p_authorized: boolean;
  a2p_info_completed: boolean;
}) {
  return {
    legalBusinessName: c.legal_business_name ?? "",
    einTaxId: c.ein_tax_id ?? "",
    businessType: c.business_type ?? "",
    repFirstName: c.a2p_rep_first_name ?? "",
    repLastName: c.a2p_rep_last_name ?? "",
    repEmail: c.a2p_rep_email ?? "",
    repPhone: c.a2p_rep_phone ?? "",
    authorized: c.a2p_authorized,
    completed: c.a2p_info_completed,
  };
}
