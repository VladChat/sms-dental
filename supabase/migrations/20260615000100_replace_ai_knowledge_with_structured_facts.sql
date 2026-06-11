-- Replace the question-answer AI Knowledge model with structured clinic facts.
--
-- The previous public.clinic_ai_knowledge_entries table (migration
-- 20260614000100) stored clinic facts as free-text answers to 41 catalog
-- questions. That model is replaced by structured facts tables that a future
-- AI front desk assistant can consume directly. The old rows were TEST-ONLY
-- (no production customer data), so the table is dropped without preservation.
--
-- Still foundation-only: no AI runtime reads these tables, no Twilio/SMS
-- behavior changes, and nothing here is part of the SMS approval/billing path.
--
-- Content rules (same as before):
-- - No PHI, patient conversations, raw website HTML, screenshots, secrets, or
--   AI provider prompts/responses are ever stored in these tables.
-- - Address/website stay owned by public.clinics (Business profile); they are
--   read, not duplicated.
-- - source_type 'website_draft' rows are created by the same-origin website
--   scan and must stay status 'needs_review' until the owner approves them.

-- 1. Drop the superseded question-answer table (test-only data).
drop table if exists public.clinic_ai_knowledge_entries;

-- Shared vocabulary for all facts tables:
--   status:      not_found | needs_review | approved | do_not_use
--   source_type: manual | business_profile | website_draft | system_default

-- 2. Structured weekly office hours. interval_index supports split hours
--    (e.g. lunch breaks) later; the API caps intervals per day at 3.
create table if not exists public.clinic_ai_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  weekday smallint not null, -- 0 = Sunday … 6 = Saturday
  interval_index smallint not null default 0,
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  timezone text not null default 'America/Chicago',
  status text not null default 'needs_review',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_clinic_day_interval_unique') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_clinic_day_interval_unique
      unique (clinic_id, weekday, interval_index);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_weekday_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_weekday_check
      check (weekday between 0 and 6);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_interval_index_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_interval_index_check
      check (interval_index >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_open_close_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_open_close_check
      check (
        (is_closed and opens_at is null and closes_at is null)
        or (not is_closed and opens_at is not null and closes_at is not null and opens_at < closes_at)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_timezone_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_timezone_check
      check (length(timezone) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_status_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_source_type_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_hours_confidence_check') then
    alter table public.clinic_ai_hours
      add constraint clinic_ai_hours_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_hours_set_updated_at'
      and tgrelid = 'public.clinic_ai_hours'::regclass
  ) then
    create trigger clinic_ai_hours_set_updated_at
      before update on public.clinic_ai_hours
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 3. Selected services (catalog keys from config/ai-front-desk-facts.config.ts
--    plus server-keyed custom entries). Max 50 per clinic enforced in the API.
create table if not exists public.clinic_ai_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  service_key text not null,
  label text not null,
  selected boolean not null default false,
  is_custom boolean not null default false,
  status text not null default 'not_found',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  sort_order integer not null default 0,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_services_clinic_key_unique') then
    alter table public.clinic_ai_services
      add constraint clinic_ai_services_clinic_key_unique
      unique (clinic_id, service_key);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_services_label_check') then
    alter table public.clinic_ai_services
      add constraint clinic_ai_services_label_check
      check (length(label) between 1 and 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_services_status_check') then
    alter table public.clinic_ai_services
      add constraint clinic_ai_services_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_services_source_type_check') then
    alter table public.clinic_ai_services
      add constraint clinic_ai_services_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_services_confidence_check') then
    alter table public.clinic_ai_services
      add constraint clinic_ai_services_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_services_set_updated_at'
      and tgrelid = 'public.clinic_ai_services'::regclass
  ) then
    create trigger clinic_ai_services_set_updated_at
      before update on public.clinic_ai_services
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 4. Selected insurance plans (same shape as services).
create table if not exists public.clinic_ai_insurance_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_key text not null,
  label text not null,
  selected boolean not null default false,
  is_custom boolean not null default false,
  status text not null default 'not_found',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  sort_order integer not null default 0,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_insurance_clinic_key_unique') then
    alter table public.clinic_ai_insurance_plans
      add constraint clinic_ai_insurance_clinic_key_unique
      unique (clinic_id, plan_key);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_insurance_label_check') then
    alter table public.clinic_ai_insurance_plans
      add constraint clinic_ai_insurance_label_check
      check (length(label) between 1 and 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_insurance_status_check') then
    alter table public.clinic_ai_insurance_plans
      add constraint clinic_ai_insurance_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_insurance_source_type_check') then
    alter table public.clinic_ai_insurance_plans
      add constraint clinic_ai_insurance_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_insurance_confidence_check') then
    alter table public.clinic_ai_insurance_plans
      add constraint clinic_ai_insurance_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_insurance_plans_set_updated_at'
      and tgrelid = 'public.clinic_ai_insurance_plans'::regclass
  ) then
    create trigger clinic_ai_insurance_plans_set_updated_at
      before update on public.clinic_ai_insurance_plans
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 5. Appointment intake settings (one row per clinic). These describe which
--    appointment REQUESTS the office handles; nothing here books appointments.
create table if not exists public.clinic_ai_appointment_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  accepting_new_patients boolean,
  cleaning_appointments boolean,
  same_day_appointments boolean,
  emergency_appointments boolean,
  reschedule_cancel_requests boolean,
  preferred_time_question text not null default 'What name should we use, and what day or time works best?',
  status text not null default 'needs_review',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_appt_preferred_q_check') then
    alter table public.clinic_ai_appointment_settings
      add constraint clinic_ai_appt_preferred_q_check
      check (length(preferred_time_question) between 1 and 180);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_appt_status_check') then
    alter table public.clinic_ai_appointment_settings
      add constraint clinic_ai_appt_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_appt_source_type_check') then
    alter table public.clinic_ai_appointment_settings
      add constraint clinic_ai_appt_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_appt_confidence_check') then
    alter table public.clinic_ai_appointment_settings
      add constraint clinic_ai_appt_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_appointment_settings_set_updated_at'
      and tgrelid = 'public.clinic_ai_appointment_settings'::regclass
  ) then
    create trigger clinic_ai_appointment_settings_set_updated_at
      before update on public.clinic_ai_appointment_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 6. Payment options (one row per clinic). Pricing stays a short optional
--    policy text — never forced exact prices.
create table if not exists public.clinic_ai_payment_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  payment_plans boolean,
  financing boolean,
  carecredit boolean,
  membership_plan boolean,
  pricing_policy text,
  status text not null default 'not_found',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_payment_pricing_check') then
    alter table public.clinic_ai_payment_settings
      add constraint clinic_ai_payment_pricing_check
      check (pricing_policy is null or length(pricing_policy) <= 300);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_payment_status_check') then
    alter table public.clinic_ai_payment_settings
      add constraint clinic_ai_payment_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_payment_source_type_check') then
    alter table public.clinic_ai_payment_settings
      add constraint clinic_ai_payment_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_payment_confidence_check') then
    alter table public.clinic_ai_payment_settings
      add constraint clinic_ai_payment_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_payment_settings_set_updated_at'
      and tgrelid = 'public.clinic_ai_payment_settings'::regclass
  ) then
    create trigger clinic_ai_payment_settings_set_updated_at
      before update on public.clinic_ai_payment_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 7. Office policies (one row per clinic).
create table if not exists public.clinic_ai_office_policies (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  new_patient_forms text,
  what_to_bring text,
  cancellation_policy text,
  languages text[] not null default '{}',
  parking_notes text,
  accessibility_notes text,
  status text not null default 'not_found',
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  confidence numeric(4,3),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_policies_text_len_check') then
    alter table public.clinic_ai_office_policies
      add constraint clinic_ai_policies_text_len_check
      check (
        (new_patient_forms is null or length(new_patient_forms) <= 300)
        and (what_to_bring is null or length(what_to_bring) <= 300)
        and (cancellation_policy is null or length(cancellation_policy) <= 300)
        and (parking_notes is null or length(parking_notes) <= 300)
        and (accessibility_notes is null or length(accessibility_notes) <= 300)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_policies_languages_check') then
    alter table public.clinic_ai_office_policies
      add constraint clinic_ai_policies_languages_check
      check (array_length(languages, 1) is null or array_length(languages, 1) <= 20);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_policies_status_check') then
    alter table public.clinic_ai_office_policies
      add constraint clinic_ai_policies_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_policies_source_type_check') then
    alter table public.clinic_ai_office_policies
      add constraint clinic_ai_policies_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_policies_confidence_check') then
    alter table public.clinic_ai_office_policies
      add constraint clinic_ai_policies_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_office_policies_set_updated_at'
      and tgrelid = 'public.clinic_ai_office_policies'::regclass
  ) then
    create trigger clinic_ai_office_policies_set_updated_at
      before update on public.clinic_ai_office_policies
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 8. Website scan run log. Stores run outcomes and short review notes only —
--    never raw HTML, screenshots, or AI prompts/responses.
create table if not exists public.clinic_website_scan_runs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  website_url text not null,
  status text not null,
  pages_scanned integer not null default 0,
  facts_found integer not null default 0,
  review_notes text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_website_scan_runs_status_check') then
    alter table public.clinic_website_scan_runs
      add constraint clinic_website_scan_runs_status_check
      check (status in ('running', 'completed', 'failed'));
  end if;
end $$;

create index if not exists clinic_website_scan_runs_clinic_idx
  on public.clinic_website_scan_runs (clinic_id, started_at desc);

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_ai_hours enable row level security;
alter table public.clinic_ai_services enable row level security;
alter table public.clinic_ai_insurance_plans enable row level security;
alter table public.clinic_ai_appointment_settings enable row level security;
alter table public.clinic_ai_payment_settings enable row level security;
alter table public.clinic_ai_office_policies enable row level security;
alter table public.clinic_website_scan_runs enable row level security;
