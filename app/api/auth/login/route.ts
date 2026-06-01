import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { findPrimaryActiveMembershipForProfile } from "../../../../lib/db/clinic-memberships";
import { routeForRole } from "../../../../lib/auth/access";
import { resolvePlatformAdminFromUser } from "../../../../lib/auth/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please enter your email and password.");
  }

  const supabase = await createSupabaseServerClient();
  const signIn = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });
  if (signIn.error || !signIn.data.user) {
    return jsonError(401, "invalid_credentials", "Invalid email or password.");
  }

  const membership = await findPrimaryActiveMembershipForProfile(signIn.data.user.id);
  if (!membership) {
    const admin = await resolvePlatformAdminFromUser({
      id: signIn.data.user.id,
      email: signIn.data.user.email,
    });
    await supabase.auth.signOut();
    if (admin.ok) {
      return jsonError(
        403,
        "role_mismatch_platform_admin",
        "This account uses platform admin sign in. Please use /admin/login.",
      );
    }
    return jsonError(
      403,
      "membership_not_found",
      "Your account is not linked to a clinic yet. Please contact support.",
    );
  }

  return jsonOk({
    ok: true,
    redirect: routeForRole(membership.role),
  });
}
