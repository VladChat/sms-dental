-- Account notification settings foundation.
--
-- Two clinic-scoped tables:
--
--   clinic_notification_preferences — which account notifications an owner/admin
--     wants to receive. v1 covers AI answered call minute alerts (90% / 100%).
--     A missing row means "use the config default" (currently enabled), so the
--     account UI never depends on rows existing.
--
--   clinic_notifications — internal notification records for future use. Nothing
--     writes to it in this milestone; it exists so later evaluation work has a
--     deduped place to record an alert. No delivery (email/SMS), no jobs, no
--     usage metering are added here.
--
-- Foundation-only: no notification evaluation logic, no AI minute counter, no
-- scheduled job, no overage billing change. Settings + tables only.
--
-- Safety: clinic-scoped, RLS enabled, NO public policies — server route handlers
-- reach these via the service-role DB URL like other internal clinic-scoped
-- tables. Do not store PHI or patient conversations in notification payloads.

-- --------------------------------------------------------------------------
-- Notification preferences (one row per clinic + notification_type).
-- --------------------------------------------------------------------------

create table if not exists public.clinic_notification_preferences (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  updated_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clinic_id, notification_type)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_notification_preferences_set_updated_at'
      and tgrelid = 'public.clinic_notification_preferences'::regclass
  ) then
    create trigger clinic_notification_preferences_set_updated_at
      before update on public.clinic_notification_preferences
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_notification_preferences enable row level security;

-- --------------------------------------------------------------------------
-- Notification records (future internal use; nothing writes here yet).
-- --------------------------------------------------------------------------

create table if not exists public.clinic_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  notification_type text not null,
  dedupe_key text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (clinic_id, notification_type, dedupe_key)
);

create index if not exists clinic_notifications_clinic_created_idx
  on public.clinic_notifications (clinic_id, created_at desc);

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_notifications enable row level security;
