import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import { createClinicNumberRequest } from "@/lib/db/clinic-number-requests";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/phone-numbers/request
//
// Saves the owner's selected local number as a PENDING request for admin review.
// It is an owner preference only: it NEVER purchases, reserves, assigns,
// provisions, or configures a Twilio number, never writes clinic_phone_numbers,
// and never enables SMS recovery. The clinic is derived from the authenticated
// session — no client-supplied clinic id is trusted.
const BodySchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be E.164 (starts with +)."),
  friendly_name: z.string().trim().max(160).optional().nullable(),
  locality: z.string().trim().max(160).optional().nullable(),
  region: z.string().trim().max(160).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  capabilities: z
    .object({
      voice: z.boolean(),
      sms: z.boolean(),
      mms: z.boolean().optional(),
    })
    .passthrough(),
  type: z.enum(["local", "toll_free"]).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    return jsonUnauthorized("Please sign in to continue.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot request a number.");
  }

  const clinic = access.clinic;

  // Payment method remains a prerequisite (mirrors the owner UI gate). This is a
  // saved-method check only — no charge, and no Stripe call here.
  if (!clinic.stripe_payment_method_id) {
    return jsonError(
      400,
      "payment_method_required",
      "Add a payment method before requesting a number.",
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Please choose a valid number to request.");
  }
  const b = parsed.data;
  if (b.capabilities.voice !== true || b.capabilities.sms !== true) {
    return jsonError(
      400,
      "invalid_capabilities",
      "The selected number must support voice and SMS.",
    );
  }

  try {
    const row = await createClinicNumberRequest({
      clinicId: clinic.id,
      requestedPhoneNumber: b.phone_number,
      friendlyName: b.friendly_name ?? null,
      locality: b.locality ?? null,
      region: b.region ?? null,
      postalCode: b.postal_code ?? null,
      numberType: b.type ?? "local",
      capabilities: {
        voice: b.capabilities.voice,
        sms: b.capabilities.sms,
        mms: Boolean(b.capabilities.mms),
      },
      requestedByProfileId: access.userId,
      requestedByEmail: access.userEmail ?? clinic.owner_contact_email ?? null,
    });

    logger.info("account.number_request.saved", {
      clinicId: clinic.id,
      status: row.status,
    });

    return jsonOk({
      ok: true,
      requestedNumber: {
        phoneNumber: row.requested_phone_number,
        friendlyName: row.friendly_name,
        locality: row.locality,
        region: row.region,
        status: row.status,
      },
    });
  } catch (err) {
    logger.error("account.number_request.failed", {
      clinicId: clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(
      500,
      "request_failed",
      "Could not save your requested number. Please try again.",
    );
  }
}
