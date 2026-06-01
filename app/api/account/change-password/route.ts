import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getSupabaseProjectConfig } from "../../../../lib/supabase/config";
import { getPasswordValidationError } from "../../../../lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
});

// POST /api/account/change-password
//
// In-session password change for the signed-in user. We verify the current
// password first (using a throwaway client so the active session cookies are not
// disturbed), then update the password on the authenticated session. Passwords
// are never logged. This does not touch the forgot/reset-password flow or
// login/logout.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonUnauthorized("Please sign in to continue.");
  }
  const email = userData.user.email;
  if (!email) {
    return jsonError(400, "no_account_email", "This account has no email on file.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please complete all password fields.");
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return jsonBadRequest("New passwords do not match.");
  }
  const passwordError = getPasswordValidationError(parsed.data.newPassword);
  if (passwordError) {
    return jsonBadRequest(passwordError);
  }

  // Verify the current password on a throwaway client (no session persistence),
  // so checking it never rewrites the caller's session cookies.
  const { url, anonKey } = getSupabaseProjectConfig();
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verify = await verifier.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (verify.error || !verify.data.user) {
    return jsonBadRequest("Your current password is incorrect.");
  }

  // Update the password on the authenticated session.
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateError) {
    // Supabase rejects an unchanged password ("New password should be different…").
    const message =
      updateError.message && /different/i.test(updateError.message)
        ? "Choose a new password that is different from your current one."
        : "Could not update password. Please try again.";
    return jsonError(500, "password_update_failed", message);
  }

  return jsonOk({ ok: true, message: "Password updated." });
}
