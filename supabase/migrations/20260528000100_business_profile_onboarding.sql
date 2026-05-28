-- Business Profile onboarding — schema extensions.
--
-- Supports the simplified Business Profile onboarding flow:
--   Screen 1 "Create office profile" (name, main_phone, postal_code) →
--   Screen 2 "Business Profile" page (Business Information card,
--   A2P Approval Information card, Public Business Page, Billing, etc.).
--
-- Adds to public.clinics:
--   * Business Information fields (EIN/Tax ID, business type, street address,
--     website). Clinic name / main_phone / city / state_region / postal_code /
--     legal_business_name / country already exist from earlier migrations.
--   * A2P representative fields (collected for future carrier submission;
--     stored locally only — this migration does NOT submit anything to Twilio).
--   * Customer-facing status fields surfaced on the Business Profile page
--     (local_number_status, sms_status, billing_status) plus completion flags.
--   * Trial + Stripe identifier fields. Billing/trial stay inert until SMS
--     recovery is activated; trial countdown does not start while approval is
--     pending.
--
-- Design notes for a future super-admin view:
--   These columns let an admin list every business profile with its local
--   number status, SMS/A2P status, billing status, generated business-page
--   slug, and provider identifiers — without building the admin UI now.
--
-- This migration is NOT applied automatically. Apply via Supabase SQL editor
-- or admin DB connection after explicit owner approval. Earlier migrations
-- (20260525000100, 20260526000300, 20260527000100) should be applied first.

-- ---------------------------------------------------------------------------
-- Business Information fields
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists ein_tax_id text,
  add column if not exists business_type text,
  add column if not exists street_address text,
  add column if not exists website text,
  add column if not exists business_info_completed boolean not null default false;

-- ---------------------------------------------------------------------------
-- A2P representative fields (stored locally for future submission)
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists a2p_rep_first_name text,
  add column if not exists a2p_rep_last_name text,
  add column if not exists a2p_rep_business_title text,
  add column if not exists a2p_rep_email text,
  add column if not exists a2p_rep_phone text,
  add column if not exists a2p_authorized boolean not null default false,
  add column if not exists a2p_info_completed boolean not null default false;

-- ---------------------------------------------------------------------------
-- Customer-facing status + lifecycle fields
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists local_number_status text not null default 'preparing',
  add column if not exists sms_status text not null default 'preparing',
  add column if not exists billing_status text not null default 'not_started',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Status allowlists (idempotent so re-runs are safe).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinics_local_number_status_check') then
    alter table public.clinics
      add constraint clinics_local_number_status_check
      check (local_number_status in ('preparing', 'reserved', 'assigned'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinics_sms_status_check') then
    alter table public.clinics
      add constraint clinics_sms_status_check
      check (sms_status in ('preparing', 'waiting_for_approval', 'active'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinics_billing_status_check') then
    alter table public.clinics
      add constraint clinics_billing_status_check
      check (billing_status in ('not_started', 'trialing', 'active', 'past_due', 'canceled'));
  end if;
end $$;

-- slug already exists (unique) from the foundation migration. The app
-- generates a slug from the clinic name during onboarding and uses it for
-- the public /business/{slug} pages.
