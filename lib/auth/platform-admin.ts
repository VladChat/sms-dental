import { createSupabaseServerClient } from "../supabase/server";
import { findProfileById } from "../db/profiles";
import { getPlatformAdminEmails } from "../env";
import type { NextRequest } from "next/server";

// Platform-admin authorization. This is intentionally SEPARATE from
// `resolveAuthClinicAccess` (which requires a clinic membership): platform admins
// are cross-tenant and may have no clinic membership at all. Clinic `owner`/`admin`
// or `front_desk` membership never grants platform-admin access.
export type PlatformAdminResult =
  | { ok: true; userId: string; email: string; source: "allowlist" | "profile_flag" }
  | { ok: false; reason: "no_session" | "not_authorized" };

type PlatformAdminUser = {
  id: string;
  email?: string | null;
};

export async function resolvePlatformAdminFromUser(
  user: PlatformAdminUser,
): Promise<
  Extract<PlatformAdminResult, { ok: true }> | { ok: false; reason: "not_authorized" }
> {
  const email = (user.email ?? "").trim().toLowerCase();
  const allow = getPlatformAdminEmails();
  if (email.length > 0 && allow.includes(email)) {
    return { ok: true, userId: user.id, email, source: "allowlist" };
  }

  const profile = await findProfileById(user.id).catch(() => null);
  if (profile?.is_internal_admin) {
    return {
      ok: true,
      userId: user.id,
      email: email || profile.email.toLowerCase(),
      source: "profile_flag",
    };
  }

  return { ok: false, reason: "not_authorized" };
}

export async function resolvePlatformAdmin(
  request?: Pick<NextRequest, "cookies">,
): Promise<PlatformAdminResult> {
  const supabase = await createSupabaseServerClient(
    request ? { request } : undefined,
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, reason: "no_session" };
  }
  return resolvePlatformAdminFromUser({
    id: data.user.id,
    email: data.user.email,
  });
}
