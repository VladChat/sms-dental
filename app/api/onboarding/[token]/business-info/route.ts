import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  normalizeRepresentativePhone,
  validateBusinessAddress,
  validateWebsiteUrl,
} from "../../../../../lib/a2p/validation";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/business-info
//
// Saves the Business Profile section: the clinic's public-facing identity and
// business address. Legal business name, EIN, and business type are NOT saved
// here — they belong to the SMS Approval section (see ../a2p). Marks
// business_info_completed and (re)generates the public business slug.
// Returns the persisted values so the UI reflects DB-confirmed state, never
// just optimistic input. U.S.-only.

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
    return jsonBadRequest("Please complete all required business profile fields.");
  }

  const mainPhone = normalizeRepresentativePhone(parsed.data.main_phone);
  if (!/^\+1\d{10}$/.test(mainPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for your main office phone.");
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

  // Website is optional. When provided, require a safe https:// URL before storing.
  let website: string | null = null;
  const websiteRaw = parsed.data.website?.trim() ?? "";
  if (websiteRaw.length > 0) {
    const websiteIssue = validateWebsiteUrl(websiteRaw);
    if (websiteIssue) {
      return jsonBadRequest(websiteIssue.message);
    }
    website = websiteRaw;
  }

  const addressLine2Raw = parsed.data.address_line2?.trim() ?? "";

  // Persist. A DB failure must surface as a structured error, never a silent
  // "success" that disappears on reload.
  let clinic;
  try {
    clinic = await updateBusinessInformation(setupRequest.clinic_id, {
      name: parsed.data.name,
      mainPhone,
      streetAddress: parsed.data.street_address,
      addressLine2: addressLine2Raw.length > 0 ? addressLine2Raw : null,
      city: parsed.data.city,
      stateRegion: parsed.data.state_region.toUpperCase(),
      postalCode: parsed.data.postal_code,
      website,
    });
  } catch {
    return jsonError(
      500,
      "save_failed",
      "We couldn't save your business profile. Please try again.",
    );
  }

  // Generate or keep the public business slug now that we have full data.
  let slug = clinic.slug;
  if (!slug) {
    try {
      slug = await ensureClinicSlug(clinic.id, clinic.name);
    } catch {
      slug = null;
    }
  }

  // Echo persisted values so the client reconciles its state to the DB.
  return jsonOk({
    ok: true,
    clinic_id: clinic.id,
    slug,
    businessProfile: {
      name: clinic.name,
      mainPhone: clinic.main_phone ?? "",
      streetAddress: clinic.street_address ?? "",
      addressLine2: clinic.address_line2 ?? "",
      city: clinic.city ?? "",
      stateRegion: clinic.state_region ?? "",
      postalCode: clinic.postal_code ?? "",
      website: clinic.website ?? "",
      completed: clinic.business_info_completed,
    },
  });
}
