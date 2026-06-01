import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import { getAppDomains } from "../../../../lib/env";
import { jsonBadRequest, jsonError, jsonOk } from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ForgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

const GENERIC_SUCCESS_MESSAGE = "If an account exists for this email, we'll send a password reset link.";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Enter a valid email.");
  }

  try {
    const { appBaseUrl } = getAppDomains();
    const redirectTo = `${appBaseUrl}/auth/callback?next=/reset-password`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email.toLowerCase(),
      { redirectTo },
    );

    if (error) {
      return jsonError(500, "reset_request_failed", "Could not process this request. Please try again.");
    }

    return jsonOk({
      ok: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch {
    return jsonError(500, "reset_request_failed", "Could not process this request. Please try again.");
  }
}

