-- Owner number-request billing snapshot + consent audit columns.
--
-- Additive + idempotent. Records, at request time, a pricing/consent SNAPSHOT for
-- each owner-requested number so the platform admin can review it. This does NOT
-- start any billing: pending requests are never charged, real billing is
-- revalidated at activation in a later Stripe-subscription milestone.
--
-- Existing rows are safe: they default to billing_class='included' with
-- monthly_unit_amount_cents=0 and therefore never become billable and never
-- require retroactive consent.
--
-- Does NOT touch clinic_phone_numbers, local_number_status, sms_recovery_enabled,
-- Stripe IDs, or Twilio configuration. Apply via Supabase SQL editor / Management
-- API after owner approval and a clean duplicate-open-request preflight.

alter table public.clinic_number_requests
  add column if not exists billing_class text not null default 'included',
  add column if not exists monthly_unit_amount_cents integer not null default 0,
  add column if not exists currency text not null default 'usd',
  add column if not exists billing_consent_text_version text,
  add column if not exists billing_consent_text text,
  add column if not exists billing_consent_authorized_at timestamptz,
  add column if not exists billing_consent_authorized_by_profile_id uuid,
  add column if not exists billing_consent_authorized_by_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_number_requests_billing_class_check') then
    alter table public.clinic_number_requests
      add constraint clinic_number_requests_billing_class_check
      check (billing_class in ('included', 'additional'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_number_requests_monthly_amount_check') then
    alter table public.clinic_number_requests
      add constraint clinic_number_requests_monthly_amount_check
      check (monthly_unit_amount_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_number_requests_currency_nonempty_check') then
    alter table public.clinic_number_requests
      add constraint clinic_number_requests_currency_nonempty_check
      check (char_length(btrim(currency)) > 0);
  end if;

  -- 'included' => amount 0; 'additional' => amount > 0 AND a full consent snapshot.
  -- Existing rows (included, amount 0, null consent) satisfy the first branch.
  if not exists (select 1 from pg_constraint where conname = 'clinic_number_requests_billing_consistency_check') then
    alter table public.clinic_number_requests
      add constraint clinic_number_requests_billing_consistency_check
      check (
        (billing_class = 'included' and monthly_unit_amount_cents = 0)
        or
        (billing_class = 'additional'
          and monthly_unit_amount_cents > 0
          and billing_consent_text_version is not null
          and billing_consent_text is not null
          and billing_consent_authorized_at is not null
          and billing_consent_authorized_by_email is not null)
      );
  end if;
end $$;

-- Prevent duplicate OPEN requests for the same clinic + same phone number.
-- Open = pending or reviewed. Multiple different open numbers per clinic are
-- allowed (this index only blocks exact duplicates). Safe to create only after a
-- preflight confirms no existing conflicting duplicate open rows.
create unique index if not exists clinic_number_requests_open_unique_idx
  on public.clinic_number_requests (clinic_id, requested_phone_number)
  where status in ('pending', 'reviewed');
