-- Platform-admin A2P/10DLC submission tracking.
--
-- Additive + idempotent. This migration records the LOCAL review/submission
-- state of the platform-admin A2P approval workflow. It does NOT submit A2P
-- registrations, attach/detach Twilio senders, send SMS, enable
-- sms_recovery_enabled, or modify any existing provider resource.
--
-- One row per clinic holds the current review/submission state. Full history of
-- who reviewed/submitted is kept in public.admin_audit_events. Carrier resource
-- SIDs (Brand/Campaign/Customer Profile/Trust Product/Messaging Service) are
-- object references, not secrets; the full tax ID/EIN is NEVER stored here.

create table if not exists public.clinic_a2p_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Review/submission lifecycle status. Default 'draft' until the platform
  -- admin reviews the package. 'dry_run_reviewed' / 'ready_for_manual_submission'
  -- are the safe local outcomes when real submission is disabled.
  status text not null default 'draft',

  -- Mode under which the last submit action ran. 'live' is reserved and is never
  -- written by this build (real Twilio submission is not implemented).
  submission_mode text not null default 'dry_run',

  -- Target Messaging Service + the selected active numbers / PN SIDs at submit
  -- time. selected_phone_numbers is a JSON array of
  --   { "phoneNumber": "+1...", "twilioPhoneNumberSid": "PN..." }.
  target_messaging_service_sid text,
  selected_phone_numbers jsonb not null default '[]'::jsonb,

  -- Twilio A2P/10DLC resource SIDs (populated only by a future real submission
  -- or by read-only status sync). Object references, not secrets.
  twilio_customer_profile_sid text,
  twilio_secondary_customer_profile_sid text,
  twilio_trust_product_sid text,
  twilio_brand_registration_sid text,
  twilio_campaign_sid text,
  twilio_messaging_service_sid text,

  -- Who performed the submit/review action and when. In dry-run mode
  -- submitted_at records when the admin marked the package reviewed/ready; it
  -- does NOT mean anything was sent to Twilio.
  submitted_at timestamptz,
  submitted_by_admin_user_id uuid,
  submitted_by_admin_email text,

  -- Status-sync bookkeeping (from the read-only readiness sync, never a mutation).
  last_status_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  rejection_reason text,

  -- Redacted snapshot of the reviewed package. Never contains the full EIN/tax
  -- ID, secrets, tokens, or patient data.
  payload_snapshot jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_a2p_submissions_clinic_unique') then
    alter table public.clinic_a2p_submissions
      add constraint clinic_a2p_submissions_clinic_unique unique (clinic_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_a2p_submissions_status_check') then
    alter table public.clinic_a2p_submissions
      add constraint clinic_a2p_submissions_status_check
      check (status in (
        'draft',
        'missing_info',
        'ready_for_review',
        'submit_disabled',
        'dry_run_reviewed',
        'ready_for_manual_submission',
        'submitted',
        'pending',
        'approved',
        'rejected',
        'failed',
        'blocked'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_a2p_submissions_mode_check') then
    alter table public.clinic_a2p_submissions
      add constraint clinic_a2p_submissions_mode_check
      check (submission_mode in ('disabled', 'dry_run', 'live'));
  end if;
end $$;

create index if not exists clinic_a2p_submissions_clinic_idx
  on public.clinic_a2p_submissions (clinic_id);

create index if not exists clinic_a2p_submissions_status_idx
  on public.clinic_a2p_submissions (status, updated_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_a2p_submissions_set_updated_at'
      and tgrelid = 'public.clinic_a2p_submissions'::regclass
  ) then
    create trigger clinic_a2p_submissions_set_updated_at
      before update on public.clinic_a2p_submissions
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_a2p_submissions enable row level security;
