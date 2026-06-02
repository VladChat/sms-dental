-- Owner-requested phone numbers (owner preference for admin review).
--
-- Additive + idempotent. Records the local number an owner selected on
-- /account -> Phone number so the platform admin can review it and manually
-- finish assignment later. This NEVER purchases, reserves, assigns, provisions,
-- or configures a Twilio number; it does NOT touch clinic_phone_numbers,
-- local_number_status, or sms_recovery_enabled. Apply via Supabase SQL editor /
-- Management API after owner approval.

create table if not exists public.clinic_number_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requested_phone_number text not null,
  friendly_name text,
  locality text,
  region text,
  postal_code text,
  number_type text not null default 'local',
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  requested_by_profile_id uuid,
  requested_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  admin_note text,
  constraint clinic_number_requests_status_check
    check (status in ('pending', 'reviewed', 'fulfilled', 'rejected', 'cancelled')),
  constraint clinic_number_requests_number_type_check
    check (number_type in ('local', 'toll_free')),
  constraint clinic_number_requests_phone_nonempty_check
    check (char_length(btrim(requested_phone_number)) > 0)
);

create index if not exists clinic_number_requests_clinic_created_idx
  on public.clinic_number_requests (clinic_id, created_at desc);

-- Fast lookup of the live (pending) request per clinic.
create index if not exists clinic_number_requests_clinic_pending_idx
  on public.clinic_number_requests (clinic_id)
  where status = 'pending';

-- updated_at maintenance (reuses the shared trigger function). Guarded so the
-- migration is safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_number_requests_set_updated_at'
      and tgrelid = 'public.clinic_number_requests'::regclass
  ) then
    create trigger clinic_number_requests_set_updated_at
      before update on public.clinic_number_requests
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_number_requests enable row level security;
