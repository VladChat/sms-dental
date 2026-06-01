import {
  findSetupRequestByTokenHash,
  type SetupRequestRow,
} from "../db/setup-requests";
import { findAuthUserByEmail } from "../db/auth-users";
import {
  hashSetupToken,
  isExpired,
  isLikelyRawToken,
} from "./tokens";

export type SetupTokenLookupResult =
  | { ok: true; setupRequest: SetupRequestRow }
  | { ok: false; reason: "not_found" | "expired" | "completed" | "cancelled" | "invalid_format" };

/**
 * Look up a setup request by its raw token. The raw token is hashed and
 * compared against `setup_token_hash`. Tokens in terminal states or past
 * their expiry are rejected.
 */
export async function lookupSetupRequestByRawToken(
  rawToken: string,
): Promise<SetupTokenLookupResult> {
  if (!isLikelyRawToken(rawToken)) {
    return { ok: false, reason: "invalid_format" };
  }
  const hash = hashSetupToken(rawToken);
  const row = await findSetupRequestByTokenHash(hash);
  if (!row) return { ok: false, reason: "not_found" };
  if (isExpired(row.expires_at)) return { ok: false, reason: "expired" };
  if (row.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (row.status === "expired") return { ok: false, reason: "expired" };
  if (row.status === "active") return { ok: false, reason: "completed" };
  return { ok: true, setupRequest: row };
}

/**
 * Canonical "setup already completed" marker.
 *
 * The setup form exists only to create the owner auth account + password. So
 * once an auth user exists for the setup request's owner email, setup must be
 * treated as complete: the form must not render again, and the submit handler
 * must not create duplicate accounts, overwrite the password, or rerun setup.
 *
 * Using the linked auth account (rather than a setup_requests status) is the
 * reliable marker — it is true for old links too, so no backfill/migration is
 * needed, and it cannot be bypassed by reopening a stale email link. The setup
 * request's `status` advances through several non-`active` values (e.g.
 * `clinic_details_completed`) after the account is created, so status alone is
 * not a dependable completion signal here.
 */
export async function isSetupAlreadyCompleted(ownerEmail: string): Promise<boolean> {
  const authUser = await findAuthUserByEmail(ownerEmail);
  return Boolean(authUser);
}
