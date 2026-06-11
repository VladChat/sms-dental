-- Refine the AI Front Desk payment facts into two clear owner sections:
--   Payment methods    — which methods the office accepts (cash, cards, …)
--   Financing & plans   — financing options offered (in-office plans, CareCredit,
--                          Alphaeon, membership, plus owner-added custom options)
--
-- The old single Payment section stored payment_plans / financing / carecredit /
-- membership_plan / pricing_policy on clinic_ai_payment_settings. This migration:
--   1. Adds structured payment-method + financing boolean columns.
--   2. Backfills in_office_payment_plans from the legacy payment_plans column.
--   3. Adds clinic_ai_financing_options for owner-added custom financing options.
--
-- The legacy payment_plans / financing / pricing_policy columns are left in place
-- but unused; pricing_policy is cleared on the next owner save. No data is dropped.
--
-- Still foundation-only: no AI runtime reads these tables, no Twilio/SMS behavior
-- changes, and no PHI / raw HTML / secrets are stored here.

-- 1. New payment-method + financing boolean columns on the per-clinic payment row.
alter table public.clinic_ai_payment_settings
  add column if not exists cash boolean,
  add column if not exists credit_debit_cards boolean,
  add column if not exists personal_checks boolean,
  add column if not exists hsa_fsa_cards boolean,
  add column if not exists in_office_payment_plans boolean,
  add column if not exists alphaeon_credit boolean;

-- 2. Backfill the renamed payment-plan flag from the legacy column (once).
update public.clinic_ai_payment_settings
  set in_office_payment_plans = payment_plans
  where in_office_payment_plans is null and payment_plans is not null;

-- 3. Owner-added custom financing options. Default financing options stay as
--    booleans on clinic_ai_payment_settings; only custom options live here.
--    Max 50 per clinic is enforced server-side. Keys are minted server-side.
create table if not exists public.clinic_ai_financing_options (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  option_key text not null,
  label text not null,
  selected boolean not null default true,
  is_custom boolean not null default true,
  status text not null default 'approved',
  source_type text not null default 'manual',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_financing_clinic_key_unique') then
    alter table public.clinic_ai_financing_options
      add constraint clinic_ai_financing_clinic_key_unique
      unique (clinic_id, option_key);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_financing_label_check') then
    alter table public.clinic_ai_financing_options
      add constraint clinic_ai_financing_label_check
      check (length(label) between 1 and 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_financing_status_check') then
    alter table public.clinic_ai_financing_options
      add constraint clinic_ai_financing_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'do_not_use'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_financing_source_type_check') then
    alter table public.clinic_ai_financing_options
      add constraint clinic_ai_financing_source_type_check
      check (source_type in ('manual', 'business_profile', 'website_draft', 'system_default'));
  end if;
end $$;

create index if not exists clinic_ai_financing_options_clinic_idx
  on public.clinic_ai_financing_options (clinic_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_financing_options_set_updated_at'
      and tgrelid = 'public.clinic_ai_financing_options'::regclass
  ) then
    create trigger clinic_ai_financing_options_set_updated_at
      before update on public.clinic_ai_financing_options
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_ai_financing_options enable row level security;
