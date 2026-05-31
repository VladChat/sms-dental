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
  upsertClinicForOnboarding,
  type ClinicOnboardingInput,
} from "../../../../../lib/db/clinics";
import {
  attachClinicToSetupRequest,
  setSetupRequestStatus,
} from "../../../../../lib/db/setup-requests";
import { isValidE164, normalizePhone } from "../../../../../lib/phone/normalize";
import { prepareLocalNumber } from "../../../../../lib/onboarding/local-number";
import { setAccountSessionCookie } from "../../../../../lib/onboarding/account-session";
import { getPasswordValidationError } from "../../../../../lib/auth/password";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { findAuthUserByEmail } from "../../../../../lib/db/auth-users";
import { upsertProfile } from "../../../../../lib/db/profiles";
import { upsertClinicMembership } from "../../../../../lib/db/clinic-memberships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MVP onboarding Step 1 is U.S.-only and asks for only the three fields
// required to complete the next step (number search): clinic name, main
// office phone, and ZIP code. See AGENTS.md "Form and Onboarding Scope Rule".
//
// Older payloads that include extra fields (city, state_region, country,
// timezone, owner_*, test_patient_phone, setup_mode, preferred_area_code,
// legal_business_name) are still accepted for backward compatibility, but
// only the three required fields drive behavior here. Any submitted country
// other than "US" is rejected because automated onboarding does not yet
// support other countries.

const ClinicFormSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    main_phone: z.string().trim().min(7).max(40),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{5}(-\d{4})?$/u, "Please enter a 5-digit ZIP code."),
    // Accepted but optional / ignored for behavior. Helps stale clients.
    country: z.string().trim().optional(),
    password: z.string().min(1).max(128),
    confirm_password: z.string().min(1).max(128),
  })
  .passthrough();

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
    const zipIssue = parsed.error.issues.find((i) => i.path.includes("postal_code"));
    if (zipIssue) {
      return jsonBadRequest("Please enter a 5-digit ZIP code.");
    }
    return jsonBadRequest("Please complete all required fields.");
  }

  if (parsed.data.password !== parsed.data.confirm_password) {
    return jsonBadRequest("Passwords do not match.");
  }
  const passwordError = getPasswordValidationError(parsed.data.password);
  if (passwordError) {
    return jsonBadRequest(passwordError);
  }

  // U.S.-only automated onboarding: reject any non-US country if a stale
  // client sends one. Missing country is treated as US.
  const submittedCountry = (parsed.data.country ?? "US").toUpperCase();
  if (submittedCountry !== "US") {
    return jsonError(
      400,
      "country_not_supported",
      "Automated setup is currently available for U.S. clinics only.",
    );
  }

  const mainPhone = normalizePhone(parsed.data.main_phone);
  if (!isValidE164(mainPhone)) {
    return jsonBadRequest(
      "Please enter a valid U.S. phone number for your main office phone.",
    );
  }

  const input: ClinicOnboardingInput = {
    name: parsed.data.name,
    mainPhone,
    country: "US",
    postalCode: parsed.data.postal_code,
    // Use the verified setup-request email as the owner contact email so we
    // don't ask the user twice. Everything else is collected later.
    ownerContactEmail: setupRequest.owner_email,
  };

  const clinic = await upsertClinicForOnboarding({
    existingClinicId: setupRequest.clinic_id,
    input,
  });

  if (setupRequest.clinic_id !== clinic.id) {
    await attachClinicToSetupRequest(setupRequest.id, clinic.id);
  }
  await setSetupRequestStatus(setupRequest.id, "clinic_details_completed");

  // Generate the public business slug and trigger automatic local-number
  // preparation. Both are best-effort and must not fail office creation.
  let slug: string | null = null;
  try {
    slug = await ensureClinicSlug(clinic.id, clinic.name);
  } catch {
    slug = null;
  }
  try {
    await prepareLocalNumber(clinic);
  } catch {
    // status stays "preparing"; non-blocking.
  }

  // Create the owner auth account when needed. If one already exists for this
  // setup email, do not create a duplicate.
  let existingAuth = await findAuthUserByEmail(setupRequest.owner_email);
  let authUserId = existingAuth?.id ?? null;
  let authExistedBefore = Boolean(existingAuth);

  if (!authUserId) {
    const admin = createSupabaseAdminClient();
    const createRes = await admin.auth.admin.createUser({
      email: setupRequest.owner_email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: setupRequest.owner_full_name,
      },
    });

    if (createRes.error || !createRes.data.user) {
      // Handle race/duplicate safely: check once more by email before failing.
      existingAuth = await findAuthUserByEmail(setupRequest.owner_email);
      if (!existingAuth?.id) {
        return jsonError(
          502,
          "account_create_failed",
          "We couldn't finish account setup right now. Please try again.",
        );
      }
      authUserId = existingAuth.id;
      authExistedBefore = true;
    } else {
      authUserId = createRes.data.user.id;
    }
  }

  await upsertProfile({
    id: authUserId,
    email: setupRequest.owner_email,
    fullName: setupRequest.owner_full_name,
  });
  await upsertClinicMembership({
    clinicId: clinic.id,
    profileId: authUserId,
    role: "owner",
    status: "active",
  });

  // Establish account context (httpOnly cookie) so the customer can move to the
  // clean /account URL instead of keeping the long token in the address bar.
  await setAccountSessionCookie(token);

  // Establish real authenticated session. If an account already existed and the
  // entered password is wrong, keep the flow safe and direct to /login.
  const supabase = await createSupabaseServerClient();
  const signIn = await supabase.auth.signInWithPassword({
    email: setupRequest.owner_email,
    password: parsed.data.password,
  });
  if (signIn.error) {
    if (authExistedBefore) {
      return jsonError(
        409,
        "owner_user_exists_login_required",
        "An account for this email already exists. Please sign in at /login to continue.",
      );
    }
    return jsonError(
      502,
      "session_create_failed",
      "Your account was created, but we couldn't sign you in. Please use /login.",
    );
  }

  return jsonOk({
    ok: true,
    clinic_id: clinic.id,
    main_phone: clinic.main_phone,
    country: clinic.country,
    slug,
    redirect: "/account",
  });
}
