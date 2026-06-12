-- Front-desk Workspace queue state + clinic-scoped PATIENT number blocks.
--
-- Additive + idempotent. Nothing here sends SMS, mutates Twilio, or deletes
-- data:
--   - clinic_blocked_patient_numbers blocks a PATIENT/CALLER phone number for
--     ONE clinic. It never touches the clinic's own Twilio business number,
--     never deletes history, and is separate from carrier opt-outs
--     (public.opt_outs). Blocked numbers stop receiving automation; inbound
--     messages are still recorded for audit/context.
--   - patient_conversations gains workspace queue state (archive/handled).
--     Archiving hides a conversation from the active queue; it never deletes
--     messages or the patient phone number and is reversible (Reopen).

-- 1. Clinic-scoped patient number block list (server/service-role only).
create table if not exists public.clinic_blocked_patient_numbers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  phone_number text not null,
  blocked_at timestamptz not null default now(),
  blocked_by_profile_id uuid,
  blocked_by_email text,
  reason text,
  source_conversation_id uuid references public.patient_conversations(id) on delete set null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_blocked_patient_numbers_clinic_phone_unique'
      and conrelid = 'public.clinic_blocked_patient_numbers'::regclass
  ) then
    alter table public.clinic_blocked_patient_numbers
      add constraint clinic_blocked_patient_numbers_clinic_phone_unique
      unique (clinic_id, phone_number);
  end if;
end $$;

create index if not exists clinic_blocked_patient_numbers_clinic_idx
  on public.clinic_blocked_patient_numbers (clinic_id, phone_number);

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_blocked_patient_numbers enable row level security;

-- 2. Workspace queue state on conversations (archive / handled). Reuses the
--    existing front_desk_note column as the staff "Internal note".
alter table public.patient_conversations
  add column if not exists workspace_archived_at timestamptz,
  add column if not exists workspace_archived_by_profile_id uuid,
  add column if not exists workspace_archived_by_email text,
  add column if not exists workspace_handled_at timestamptz,
  add column if not exists workspace_handled_by_profile_id uuid,
  add column if not exists workspace_handled_by_email text;
