import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
} from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { resolvePlatformAdminFromUser } from "../../../../lib/auth/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

// POST /api/admin/login
//
// One Supabase Auth system: sign in with email/password, then require platform-
// admin authorization. If the password is valid but the account is not a platform
// admin, sign back out and return a generic "not authorized" message — this only
// occurs AFTER a successful password check, so it does not reveal whether an email
// is in the allowlist.
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

  const admin = await resolvePlatformAdminFromUser({
    id: signIn.data.user.id,
    email: signIn.data.user.email,
  });
  if (!admin.ok) {
    await supabase.auth.signOut();
    return jsonForbidden("This account is not authorized for platform admin access.");
  }

  return jsonOk({ ok: true, redirect: "/admin" });
}
