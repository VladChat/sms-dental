import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import {
  upsertClinicForOnboarding,
  type ClinicOnboardingInput,
} from "../../../../../lib/db/clinics";
import {
  attachClinicToSetupRequest,
  setSetupRequestStatus,
} from "../../../../../lib/db/setup-requests";
import { isValidE164, normalizePhone } from "../../../../../lib/phone/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ClinicFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legal_business_name: z.string().trim().min(2).max(200),
  main_phone: z.string().trim().min(7).max(20),
  timezone: z.string().trim().min(3).max(60),
  owner_contact_name: z.string().trim().min(2).max(160),
  owner_contact_email: z.string().trim().email().max(254),
  owner_contact_phone: z.string().trim().min(7).max(20),
  test_patient_phone: z.string().trim().min(7).max(20),
  setup_mode: z.enum([
    "conditional_forwarding",
    "tracking_number",
    "google_voice_forwarding_test",
  ]),
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = ClinicFormSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please complete all required fields.");
  }

  const normalize = (value: string) => normalizePhone(value);
  const phones = {
    main_phone: normalize(parsed.data.main_phone),
    owner_contact_phone: normalize(parsed.data.owner_contact_phone),
    test_patient_phone: normalize(parsed.data.test_patient_phone),
  };
  for (const [field, value] of Object.entries(phones)) {
    if (!isValidE164(value)) {
      return jsonBadRequest(
        `Please enter ${field.replace(/_/g, " ")} in E.164 format (e.g. +12245551234).`,
      );
    }
  }

  const input: ClinicOnboardingInput = {
    name: parsed.data.name,
    legalBusinessName: parsed.data.legal_business_name,
    mainPhone: phones.main_phone,
    timezone: parsed.data.timezone,
    ownerContactName: parsed.data.owner_contact_name,
    ownerContactEmail: parsed.data.owner_contact_email.toLowerCase(),
    ownerContactPhone: phones.owner_contact_phone,
    testPatientPhone: phones.test_patient_phone,
  };

  const clinic = await upsertClinicForOnboarding({
    existingClinicId: setupRequest.clinic_id,
    input,
  });

  if (setupRequest.clinic_id !== clinic.id) {
    await attachClinicToSetupRequest(setupRequest.id, clinic.id);
  }
  await setSetupRequestStatus(setupRequest.id, "clinic_details_completed");

  return jsonOk({
    ok: true,
    clinic_id: clinic.id,
    main_phone: clinic.main_phone,
  });
}
