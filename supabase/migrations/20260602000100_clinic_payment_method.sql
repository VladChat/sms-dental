-- Clinic saved payment method (Stripe sandbox/test mode).
--
-- Additive + idempotent. No data is reset, deleted, rewritten, or backfilled.
-- Apply via Supabase SQL editor or the Management API after owner approval.
--
-- Stores ONLY safe, non-secret payment-method metadata returned by Stripe:
-- object IDs, brand, last4, expiration month/year, timestamps. NEVER store a raw
-- card number, CVC, or any full card data — Stripe holds the sensitive data.
--
-- This milestone collects a payment method for FUTURE billing only. It does not
-- create a charge, subscription, invoice, or PaymentIntent. billing_status
-- semantics are unchanged. Existing stripe_customer_id / stripe_subscription_id
-- columns are preserved.

alter table public.clinics
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_payment_method_brand text,
  add column if not exists stripe_payment_method_last4 text,
  add column if not exists stripe_payment_method_exp_month integer,
  add column if not exists stripe_payment_method_exp_year integer,
  add column if not exists stripe_payment_method_added_at timestamptz,
  add column if not exists stripe_payment_method_updated_at timestamptz;

do $$
begin
  -- Expiration month must be a real month when present.
  if not exists (select 1 from pg_constraint where conname = 'clinics_stripe_pm_exp_month_check') then
    alter table public.clinics
      add constraint clinics_stripe_pm_exp_month_check
      check (stripe_payment_method_exp_month is null
        or (stripe_payment_method_exp_month between 1 and 12));
  end if;
  -- Expiration year must be a reasonable positive year when present.
  if not exists (select 1 from pg_constraint where conname = 'clinics_stripe_pm_exp_year_check') then
    alter table public.clinics
      add constraint clinics_stripe_pm_exp_year_check
      check (stripe_payment_method_exp_year is null
        or (stripe_payment_method_exp_year between 2000 and 2100));
  end if;
  -- last4 is at most 4 characters when present.
  if not exists (select 1 from pg_constraint where conname = 'clinics_stripe_pm_last4_len_check') then
    alter table public.clinics
      add constraint clinics_stripe_pm_last4_len_check
      check (stripe_payment_method_last4 is null
        or char_length(stripe_payment_method_last4) <= 4);
  end if;
end $$;
