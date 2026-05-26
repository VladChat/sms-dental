-- Automated clinic onboarding workflow — schema extensions.
--
-- Adds:
--   - setup_requests           (new table)
--   - clinics extensions       (additional onboarding fields)
--
-- This migration is NOT applied automatically. Apply via Supabase SQL editor
-- or admin DB connection after owner approval.
--
-- Apply notes:
--   * The setup_requests table stores ONLY the SHA-256 hash of the setup
--     token, never the raw token. Raw tokens are sent only in the email URL.
--   * Tokens expire at expires_at. Status transitions match the build guide.
--   * clinic_phone_numbers.role retains its existing default ('recovery') for
--     backward compatibility. New office texting numbers created by the
--     onboarding flow use role='office_texting'. We deliberately do not
--     migrate existing rows.

-- ---------------------------------------------------------------------------
-- Extend clinics with onboarding/business fields
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists legal_business_name text,
  add column if not exists main_phone text,
  add column if not exists owner_contact_name text,
  add column if not exists owner_contact_email text,
  add column if not exists owner_contact_phone text,
  add column if not exists test_patient_phone text,
  add column if not exists setup_status text not null default 'setup_pending';

-- Owner Test clinic is already operational; mark its setup_status accordingly.
update public.clinics
  set setup_status = 'active'
  where slug = 'owner-test'
    and setup_status = 'setup_pending';

-- ---------------------------------------------------------------------------
-- setup_requests
--   One row per public-site setup request. Holds the token hash, status,
--   and link back to the clinic created later in onboarding.
-- ---------------------------------------------------------------------------

create table if not exists public.setup_requests (
  id uuid primary key default gen_random_uuid(),
  owner_full_name text not null,
  owner_email text not null,
  -- Hex SHA-256 of the raw setup token. Raw token is never stored.
  setup_token_hash text not null,
  status text not null default 'requested'
    check (status in (
      'requested',
      'email_sent',
      'clinic_details_completed',
      'number_selected',
      'number_assigned',
      'qa_pending',
      'qa_passed',
      'ready_for_approval',
      'active',
      'cancelled',
      'expired'
    )),
  clinic_id uuid references public.clinics(id) on delete set null,
  last_email_sent_at timestamptz,
  email_status text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists setup_requests_setup_token_hash_key
  on public.setup_requests (setup_token_hash);

create index if not exists setup_requests_owner_email_idx
  on public.setup_requests (owner_email);

create index if not exists setup_requests_status_idx
  on public.setup_requests (status, created_at desc);

create trigger setup_requests_set_updated_at
  before update on public.setup_requests
  for each row execute function public.set_updated_at();

alter table public.setup_requests enable row level security;
