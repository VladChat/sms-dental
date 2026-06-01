import { findPrimaryActiveMembershipForProfile } from "../db/clinic-memberships";
import { routeForRole } from "./access";
import { resolvePlatformAdminFromUser } from "./platform-admin";

export type PostAuthRedirectPath =
  | "/admin"
  | "/account"
  | "/workspace"
  | "/auth/no-access";

type RedirectUser = {
  id: string;
  email?: string | null;
};

// Resolve the safest post-auth landing route for a signed-in user across all
// current app surfaces (platform admin, clinic owner/admin, front desk).
export async function resolvePostAuthRedirectPath(
  user: RedirectUser,
): Promise<PostAuthRedirectPath> {
  const admin = await resolvePlatformAdminFromUser(user);
  if (admin.ok) return "/admin";

  const membership = await findPrimaryActiveMembershipForProfile(user.id).catch(() => null);
  if (!membership) return "/auth/no-access";

  return routeForRole(membership.role);
}

