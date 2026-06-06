-- SMS launch readiness tracking.
--
-- Additive + idempotent. This migration records local read-only verification
-- state for A2P/10DLC, Messaging Service linkage, and per-number sender
-- coverage. It does not submit A2P registrations, attach/detach Twilio senders,
-- send SMS, enable sms_recovery_enabled, or modify existing provider resources.

create table if not exists public.clinic_sms_readiness (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  twilio_messaging_service_sid text,
  messaging_service_status text not null default 'unknown',
  twilio_a2p_brand_sid text,
  twilio_a2p_brand_status text not null default 'unknown',
  twilio_a2p_campaign_sid text,
  twilio_a2p_campaign_status text not null default 'unknown',
  twilio_a2p_campaign_usecase text,
  a2p_status text not null default 'unknown',
  production_safe boolean not null default false,
  launch_blocking_reason text,
  status_source text not null default 'read_only_sync',
  last_synced_at timestamptz,
  last_sync_error_code text,
  last_sync_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_readiness_ms_status_check') then
    alter table public.clinic_sms_readiness
      add constraint clinic_sms_readiness_ms_status_check
      check (messaging_service_status in ('unknown', 'missing', 'verified', 'error'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_readiness_a2p_status_check') then
    alter table public.clinic_sms_readiness
      add constraint clinic_sms_readiness_a2p_status_check
      check (a2p_status in ('unknown', 'pending', 'verified', 'failed', 'rejected', 'blocked'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_readiness_source_check') then
    alter table public.clinic_sms_readiness
      add constraint clinic_sms_readiness_source_check
      check (status_source in ('read_only_sync', 'manual', 'documented'));
  end if;
end $$;

create index if not exists clinic_sms_readiness_safe_idx
  on public.clinic_sms_readiness (production_safe, last_synced_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_sms_readiness_set_updated_at'
      and tgrelid = 'public.clinic_sms_readiness'::regclass
  ) then
    create trigger clinic_sms_readiness_set_updated_at
      before update on public.clinic_sms_readiness
      for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.clinic_sms_number_readiness (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  clinic_phone_number_id uuid not null references public.clinic_phone_numbers(id) on delete cascade,
  phone_number text not null,
  twilio_phone_number_sid text,
  twilio_messaging_service_sid text,
  messaging_service_sender_status text not null default 'unknown',
  a2p_campaign_coverage_status text not null default 'unknown',
  production_safe boolean not null default false,
  launch_blocking_reason text,
  status_source text not null default 'read_only_sync',
  last_synced_at timestamptz,
  last_sync_error_code text,
  last_sync_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_number_readiness_phone_unique') then
    alter table public.clinic_sms_number_readiness
      add constraint clinic_sms_number_readiness_phone_unique
      unique (clinic_phone_number_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_number_ms_sender_status_check') then
    alter table public.clinic_sms_number_readiness
      add constraint clinic_sms_number_ms_sender_status_check
      check (messaging_service_sender_status in ('unknown', 'covered', 'missing', 'error'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_number_a2p_coverage_status_check') then
    alter table public.clinic_sms_number_readiness
      add constraint clinic_sms_number_a2p_coverage_status_check
      check (a2p_campaign_coverage_status in ('unknown', 'covered', 'missing', 'error'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_number_source_check') then
    alter table public.clinic_sms_number_readiness
      add constraint clinic_sms_number_source_check
      check (status_source in ('read_only_sync', 'manual', 'documented'));
  end if;
end $$;

create index if not exists clinic_sms_number_readiness_clinic_idx
  on public.clinic_sms_number_readiness (clinic_id, production_safe);

create index if not exists clinic_sms_number_readiness_sid_idx
  on public.clinic_sms_number_readiness (twilio_phone_number_sid);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_sms_number_readiness_set_updated_at'
      and tgrelid = 'public.clinic_sms_number_readiness'::regclass
  ) then
    create trigger clinic_sms_number_readiness_set_updated_at
      before update on public.clinic_sms_number_readiness
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_sms_readiness enable row level security;
alter table public.clinic_sms_number_readiness enable row level security;
