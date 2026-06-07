import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  normalizeRepresentativePhone,
  validateBusinessAddress,
  validateWebsiteUrl,
} from "../../../../../../lib/a2p/validation";
import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../lib/auth/platform-admin";
import {
  ensureClinicSlug,
  findClinicById,
  updateBusinessInformation,
} from "../../../../../../lib/db/clinics";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Same field set + validation as the owner endpoint (`/api/account/business-info`).
const BusinessInfoSchema = z.object({
  name: z.string().trim().min(2).max(160),
  main_phone: z.string().trim().min(7).max(40),
  street_address: z.string().trim().min(2).max(200),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(120),
  state_region: z.string().trim().min(2).max(60),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/u, "Please enter a 5-digit ZIP code."),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

// POST /api/admin/clinics/[clinicId]/business-profile
//
// Platform-admin-scoped Business Profile edit for a single clinic. Mirrors the
// owner save behavior (same columns via updateBusinessInformation) but is guarded
// by resolvePlatformAdmin and writes an admin_audit_event. No external side effects.
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
  const parsed = BusinessInfoSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please complete all required business profile fields.");
  }

  const mainPhone = normalizeRepresentativePhone(parsed.data.main_phone);
  if (!/^\+1\d{10}$/.test(mainPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for the main office phone.");
  }

  const addressIssues = validateBusinessAddress({
    street: parsed.data.street_address,
    city: parsed.data.city,
    region: parsed.data.state_region.toUpperCase(),
    postalCode: parsed.data.postal_code,
    country: "US",
  });
  if (addressIssues.length > 0) {
    return jsonBadRequest(addressIssues[0]?.message ?? "Please complete the business address.");
  }

  let website: string | null = null;
  const websiteRaw = parsed.data.website?.trim() ?? "";
  if (websiteRaw.length > 0) {
    const websiteIssue = validateWebsiteUrl(websiteRaw);
    if (websiteIssue) {
      return jsonBadRequest(websiteIssue.message);
    }
    website = websiteRaw;
  }
  const addressLine2 = (parsed.data.address_line2?.trim() ?? "") || null;

  const current = await findClinicById(clinicId).catch(() => null);
  if (!current) return jsonError(404, "not_found", "Clinic not found.");

  // No-op detection: skip the write + audit when nothing changed and the section
  // is already marked complete (avoids noisy duplicate updates / audit rows).
  const next = {
    name: parsed.data.name,
    main_phone: mainPhone,
    street_address: parsed.data.street_address,
    address_line2: addressLine2,
    city: parsed.data.city,
    state_region: parsed.data.state_region.toUpperCase(),
    postal_code: parsed.data.postal_code,
    website,
  };
  const before: Record<string, string | null> = {
    name: current.name,
    main_phone: current.main_phone,
    street_address: current.street_address,
    address_line2: current.address_line2,
    city: current.city,
    state_region: current.state_region,
    postal_code: current.postal_code,
    website: current.website,
  };
  const changed = Object.keys(next).filter(
    (k) => (next as Record<string, string | null>)[k] !== before[k],
  );
  if (changed.length === 0 && current.business_info_completed) {
    return jsonOk({
      ok: true,
      noop: true,
      clinic_id: clinicId,
      slug: current.slug,
      businessProfile: echoBusiness(current),
    });
  }

  let clinic;
  try {
    clinic = await updateBusinessInformation(clinicId, {
      name: next.name,
      mainPhone: next.main_phone,
      streetAddress: next.street_address,
      addressLine2: next.address_line2,
      city: next.city,
      stateRegion: next.state_region.toUpperCase(),
      postalCode: next.postal_code,
      website,
    });
  } catch {
    return jsonError(500, "save_failed", "Could not save the business profile. Please try again.");
  }

  let slug = clinic.slug;
  if (!slug) {
    slug = await ensureClinicSlug(clinic.id, clinic.name).catch(() => null);
  }

  // Audit: field NAMES only — never raw values (no secrets/PII in metadata).
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.business_profile.update",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      beforeState: { business_info_completed: current.business_info_completed },
      afterState: {
        business_info_completed: clinic.business_info_completed,
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
    slug,
    businessProfile: echoBusiness(clinic),
  });
}

function echoBusiness(c: {
  name: string;
  main_phone: string | null;
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  website: string | null;
  business_info_completed: boolean;
}) {
  return {
    name: c.name,
    mainPhone: c.main_phone ?? "",
    streetAddress: c.street_address ?? "",
    addressLine2: c.address_line2 ?? "",
    city: c.city ?? "",
    stateRegion: c.state_region ?? "",
    postalCode: c.postal_code ?? "",
    website: c.website ?? "",
    completed: c.business_info_completed,
  };
}
