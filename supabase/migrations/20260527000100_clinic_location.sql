-- Clinic location fields for country-aware Twilio number search.
--
-- Adds country + civic address fields to clinics so the onboarding flow can:
--   * route local number search through the correct Twilio country
--   * surface toll-free search as a separate option
--   * remember the clinic's preferred area code across re-renders
--
-- Constraint policy:
--   * country defaults to 'US' for backward compatibility with existing rows.
--   * A check constraint limits country to the MVP allowlist ('US', 'CA').
--     Expanding the allowlist later is a one-line migration.
--   * city / state_region / postal_code / preferred_area_code are nullable —
--     they help quality but are not strictly required for search to succeed.
--
-- This migration is NOT applied automatically. Apply via Supabase SQL editor
-- or admin DB connection after owner approval. The previously committed
-- migration 20260526000300 should be applied first.

-- ---------------------------------------------------------------------------
-- Extend clinics with location/business fields
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists country text not null default 'US',
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists preferred_area_code text;

-- Add country allowlist check (idempotent so re-runs are safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinics_country_check'
  ) then
    alter table public.clinics
      add constraint clinics_country_check
      check (country in ('US', 'CA'));
  end if;
end $$;

-- Backfill: existing rows keep the 'US' default; owner-test clinic is US.
update public.clinics
  set country = 'US'
  where country is null;
