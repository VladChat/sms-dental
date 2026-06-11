import type { NextResponse } from "next/server";
import { jsonForbidden, jsonUnauthorized } from "../http/responses";
import { resolveAuthClinicAccess, type AuthClinicAccessResult } from "./access";

// Owner/admin gate for account-management APIs. Front-desk users are members
// but must not manage account settings (e.g. AI knowledge).

export type OwnerAdminAccessCheck =
  | { allowed: false; response: NextResponse }
  | { allowed: true; access: Extract<AuthClinicAccessResult, { ok: true }> };

export async function requireOwnerAdminAccess(
  frontDeskMessage = "Front desk users cannot manage these settings.",
): Promise<OwnerAdminAccessCheck> {
  const access = await resolveAuthClinicAccess();
  if (!access.ok) {
    if (access.reason === "no_session") {
      return { allowed: false, response: jsonUnauthorized("Please sign in to continue.") };
    }
    return { allowed: false, response: jsonForbidden("You do not have access to this account.") };
  }
  if (access.membership.role === "front_desk") {
    return { allowed: false, response: jsonForbidden(frontDeskMessage) };
  }
  return { allowed: true, access };
}
