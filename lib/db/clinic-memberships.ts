import { getDb } from "./client";

export type ClinicMembershipRole = "owner" | "front_desk" | "admin";
export type ClinicMembershipStatus = "active" | "inactive";

export type ClinicMembershipRow = {
  id: string;
  clinic_id: string;
  profile_id: string;
  role: ClinicMembershipRole;
  status: ClinicMembershipStatus;
  created_at: Date;
  updated_at: Date;
};

export async function upsertClinicMembership(input: {
  clinicId: string;
  profileId: string;
  role: ClinicMembershipRole;
  status?: ClinicMembershipStatus;
}): Promise<ClinicMembershipRow> {
  const sql = getDb();
  const rows = await sql<ClinicMembershipRow[]>`
    insert into public.clinic_memberships
      (clinic_id, profile_id, role, status)
    values
      (${input.clinicId}::uuid, ${input.profileId}::uuid, ${input.role}, ${input.status ?? "active"})
    on conflict (clinic_id, profile_id)
    do update set
      role = excluded.role,
      status = excluded.status
    returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("clinic_memberships upsert returned no row");
  return row;
}

export async function findPrimaryActiveMembershipForProfile(
  profileId: string,
): Promise<ClinicMembershipRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicMembershipRow[]>`
    select *
    from public.clinic_memberships
    where profile_id = ${profileId}::uuid
      and status = 'active'
    order by
      case role
        when 'owner' then 0
        when 'admin' then 1
        else 2
      end,
      created_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function listActiveMembershipsForProfile(
  profileId: string,
): Promise<ClinicMembershipRow[]> {
  const sql = getDb();
  const rows = await sql<ClinicMembershipRow[]>`
    select *
    from public.clinic_memberships
    where profile_id = ${profileId}::uuid
      and status = 'active'
    order by created_at asc
  `;
  return rows;
}

export async function listActiveMembershipsForClinic(
  clinicId: string,
): Promise<ClinicMembershipRow[]> {
  const sql = getDb();
  const rows = await sql<ClinicMembershipRow[]>`
    select *
    from public.clinic_memberships
    where clinic_id = ${clinicId}::uuid
      and status = 'active'
    order by
      case role
        when 'owner' then 0
        when 'admin' then 1
        else 2
      end,
      created_at asc
  `;
  return rows;
}
