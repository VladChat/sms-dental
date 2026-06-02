import { findClinicById, type ClinicOnboardingRow } from "../db/clinics";
import {
  findPrimaryActiveMembershipForProfile,
  type ClinicMembershipRow,
  type ClinicMembershipRole,
} from "../db/clinic-memberships";
import { createSupabaseServerClient } from "../supabase/server";
import type { NextRequest } from "next/server";

export type AuthClinicAccessResult =
  | { ok: false; reason: "no_session" | "no_membership" | "clinic_not_found" }
  | {
      ok: true;
      userId: string;
      userEmail: string | null;
      membership: ClinicMembershipRow;
      clinic: ClinicOnboardingRow;
    };

// Resolve the authenticated app session and its clinic membership. This is the
// primary auth guard for owner/front-desk app routes.
export async function resolveAuthClinicAccess(
  request?: Pick<NextRequest, "cookies">,
): Promise<AuthClinicAccessResult> {
  const supabase = await createSupabaseServerClient(
    request ? { request } : undefined,
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, reason: "no_session" };
  }

  const membership = await findPrimaryActiveMembershipForProfile(data.user.id);
  if (!membership) return { ok: false, reason: "no_membership" };

  const clinic = await findClinicById(membership.clinic_id);
  if (!clinic) return { ok: false, reason: "clinic_not_found" };

  return {
    ok: true,
    userId: data.user.id,
    userEmail: data.user.email ?? null,
    membership,
    clinic,
  };
}

export function routeForRole(role: ClinicMembershipRole): "/account" | "/workspace" {
  if (role === "front_desk") return "/workspace";
  return "/account";
}
