import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import {
  ensureClinicSlug,
  updateBusinessInformation,
} from "../../../../../lib/db/clinics";
import { isValidE164, normalizePhone } from "../../../../../lib/phone/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/business-info
//
// Saves the Business Information card on the Business Profile page. Reuses the
// office-profile fields (name, main phone, ZIP) and adds legal name, EIN/Tax
// ID, business type, and business address. Marks business_info_completed and
// (re)generates the public business slug. U.S.-only.

const BusinessInfoSchema = z.object({
  name: z.string().trim().min(2).max(160),
  main_phone: z.string().trim().min(7).max(40),
  legal_business_name: z.string().trim().min(2).max(200),
  ein_tax_id: z.string().trim().min(2).max(40),
  business_type: z.string().trim().min(2).max(80),
  street_address: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(120),
  state_region: z.string().trim().min(2).max(60),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/u, "Please enter a 5-digit ZIP code."),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) {
    return jsonError(404, "invalid_setup_link", "This setup link is invalid or expired.");
  }
  const setupRequest = lookup.setupRequest;
  if (!setupRequest.clinic_id) {
    return jsonError(
      409,
      "clinic_details_required",
      "Please create your office profile first.",
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = BusinessInfoSchema.safeParse(body);
  if (!parsed.success) {
    const zipIssue = parsed.error.issues.find((i) => i.path.includes("postal_code"));
    if (zipIssue) return jsonBadRequest("Please enter a 5-digit ZIP code.");
    return jsonBadRequest("Please complete all required business information fields.");
  }

  const mainPhone = normalizePhone(parsed.data.main_phone);
  if (!isValidE164(mainPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for your main office phone.");
  }

  const website = parsed.data.website && parsed.data.website.length > 0
    ? parsed.data.website
    : null;

  const clinic = await updateBusinessInformation(setupRequest.clinic_id, {
    name: parsed.data.name,
    mainPhone,
    postalCode: parsed.data.postal_code,
    legalBusinessName: parsed.data.legal_business_name,
    einTaxId: parsed.data.ein_tax_id,
    businessType: parsed.data.business_type,
    streetAddress: parsed.data.street_address,
    city: parsed.data.city,
    stateRegion: parsed.data.state_region,
    website,
  });

  // Generate or keep the public business slug now that we have full data.
  let slug = clinic.slug;
  if (!slug) {
    try {
      slug = await ensureClinicSlug(clinic.id, clinic.name);
    } catch {
      slug = null;
    }
  }

  return jsonOk({ ok: true, clinic_id: clinic.id, slug });
}
