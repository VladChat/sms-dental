import {
  findSetupRequestByTokenHash,
  type SetupRequestRow,
} from "../db/setup-requests";
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
