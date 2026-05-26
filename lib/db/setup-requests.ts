import { getDb } from "./client";

// Setup request lifecycle states. Matches the build guide.
export type SetupRequestStatus =
  | "requested"
  | "email_sent"
  | "clinic_details_completed"
  | "number_selected"
  | "number_assigned"
  | "qa_pending"
  | "qa_passed"
  | "ready_for_approval"
  | "active"
  | "cancelled"
  | "expired";

export type SetupRequestRow = {
  id: string;
  owner_full_name: string;
  owner_email: string;
  setup_token_hash: string;
  status: SetupRequestStatus;
  clinic_id: string | null;
  last_email_sent_at: Date | null;
  email_status: string | null;
  expires_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function insertSetupRequest(params: {
  ownerFullName: string;
  ownerEmail: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<SetupRequestRow> {
  const sql = getDb();
  const rows = await sql<SetupRequestRow[]>`
    insert into public.setup_requests
      (owner_full_name, owner_email, setup_token_hash, expires_at, status)
    values
      (${params.ownerFullName}, ${params.ownerEmail}, ${params.tokenHash}, ${params.expiresAt}, 'requested')
    returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("setup_requests insert returned no row");
  return row;
}

export async function findSetupRequestByTokenHash(
  tokenHash: string,
): Promise<SetupRequestRow | null> {
  const sql = getDb();
  const rows = await sql<SetupRequestRow[]>`
    select * from public.setup_requests
    where setup_token_hash = ${tokenHash}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function setSetupRequestStatus(
  id: string,
  status: SetupRequestStatus,
  extra?: { clinicId?: string; completedAt?: Date | null; emailStatus?: string; emailSentAt?: Date },
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.setup_requests
    set
      status = ${status},
      clinic_id = coalesce(${extra?.clinicId ?? null}, clinic_id),
      completed_at = coalesce(${extra?.completedAt ?? null}, completed_at),
      email_status = coalesce(${extra?.emailStatus ?? null}, email_status),
      last_email_sent_at = coalesce(${extra?.emailSentAt ?? null}, last_email_sent_at)
    where id = ${id}
  `;
}

export async function attachClinicToSetupRequest(
  id: string,
  clinicId: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.setup_requests
    set clinic_id = ${clinicId}
    where id = ${id}
  `;
}
