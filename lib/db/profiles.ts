import { getDb } from "./client";

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_internal_admin: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function upsertProfile(input: {
  id: string;
  email: string;
  fullName?: string | null;
}): Promise<ProfileRow> {
  const sql = getDb();
  const rows = await sql<ProfileRow[]>`
    insert into public.profiles (id, email, full_name)
    values (${input.id}::uuid, ${input.email.toLowerCase()}, ${input.fullName ?? null})
    on conflict (id)
    do update set
      email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name)
    returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("profiles upsert returned no row");
  return row;
}

export async function findProfileById(id: string): Promise<ProfileRow | null> {
  const sql = getDb();
  const rows = await sql<ProfileRow[]>`
    select *
    from public.profiles
    where id = ${id}::uuid
    limit 1
  `;
  return rows[0] ?? null;
}

export async function listProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return [];
  const sql = getDb();
  const rows = await sql<ProfileRow[]>`
    select *
    from public.profiles
    where id in ${sql(ids)}
  `;
  return rows;
}
