import { NextResponse, type NextRequest } from "next/server";

import { jsonError, jsonOk } from "../../../../lib/http/responses";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { clearAccountSessionCookie } from "../../../../lib/onboarding/account-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  await clearAccountSessionCookie();
  if (error) {
    return jsonError(500, "sign_out_failed", "Could not sign out. Please try again.");
  }
  return jsonOk({
    ok: true,
    redirect: "/login",
  });
}
