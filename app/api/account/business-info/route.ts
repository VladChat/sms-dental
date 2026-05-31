import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonOk,
} from "../../../../lib/http/responses";
import {
  ensureClinicSlug,
  updateBusinessInformation,
} from "../../../../lib/db/clinics";
import { isValidE164, normalizePhone } from "../../../../lib/phone/normalize";
import { isSafeHttpsUrl } from "../../../../lib/validation/url";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// POST /api/account/business-info
//
// Authenticated owner/account save endpoint for Business Profile updates.
// Mirrors token-based onboarding behavior while allowing normal /login users
// to continue account setup from /account.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess();
  if (!access.ok) {
    if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You do not have access to this account.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot edit business profile settings.");
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
    return jsonBadRequest("Please complete all required business profile fields.");
  }

  const mainPhone = normalizePhone(parsed.data.main_phone);
  if (!isValidE164(mainPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for your main office phone.");
  }

  let website: string | null = null;
  const websiteRaw = parsed.data.website?.trim() ?? "";
  if (websiteRaw.length > 0) {
    if (!isSafeHttpsUrl(websiteRaw)) {
      return jsonBadRequest("Please enter a valid website URL that starts with https://");
    }
    website = websiteRaw;
  }
  const addressLine2Raw = parsed.data.address_line2?.trim() ?? "";

  let clinic;
  try {
    clinic = await updateBusinessInformation(access.clinic.id, {
      name: parsed.data.name,
      mainPhone,
      streetAddress: parsed.data.street_address,
      addressLine2: addressLine2Raw.length > 0 ? addressLine2Raw : null,
      city: parsed.data.city,
      stateRegion: parsed.data.state_region,
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

  let slug = clinic.slug;
  if (!slug) {
    try {
      slug = await ensureClinicSlug(clinic.id, clinic.name);
    } catch {
      slug = null;
    }
  }

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
