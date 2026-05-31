import { getDb } from "./client";

export type AuthUserLookupRow = {
  id: string;
  email: string | null;
  created_at: Date | null;
};

// Read-only lookup of Supabase auth.users by email from trusted server code.
// Used to avoid duplicate account creation during setup-token completion.
export async function findAuthUserByEmail(
  email: string,
): Promise<AuthUserLookupRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const sql = getDb();
  const rows = await sql<AuthUserLookupRow[]>`
    select id, email, created_at
    from auth.users
    where lower(email) = ${normalized}
    limit 1
  `;
  return rows[0] ?? null;
}
