import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import { getPasswordValidationError } from "../../../../lib/auth/password";
import { resolvePostAuthRedirectPath } from "../../../../lib/auth/post-auth-redirect";
import { jsonBadRequest, jsonError, jsonOk, jsonUnauthorized } from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdatePasswordSchema = z.object({
  password: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const parsed = UpdatePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please enter and confirm your new password.");
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return jsonBadRequest("Passwords do not match.");
  }

  const passwordError = getPasswordValidationError(parsed.data.password);
  if (passwordError) {
    return jsonBadRequest(passwordError);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return jsonUnauthorized("This reset link is expired or invalid. Request a new password reset link.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    return jsonError(
      500,
      "password_update_failed",
      "Could not update password. Request a new password reset link and try again.",
    );
  }

  const redirect = await resolvePostAuthRedirectPath({
    id: data.user.id,
    email: data.user.email,
  });

  return jsonOk({
    ok: true,
    redirect,
  });
}
