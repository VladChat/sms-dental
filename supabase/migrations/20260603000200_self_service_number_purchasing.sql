-- Self-service number purchasing: clinic-level purchase controls, per-number
-- billing/audit snapshot columns, and a durable purchase-attempt table.
--
-- Additive + idempotent. No data is reset, deleted, released, rebilled, or
-- activated. Existing clinic_phone_numbers rows become source/billing_class
-- 'legacy' with amount 0 (NOT auto-billable). Existing clinic_number_requests,
-- Stripe IDs, Twilio numbers, and sms_recovery_enabled are untouched. Apply via
-- the Supabase Management API after a clean preflight (see SETUP-LOG), BEFORE
-- deploying the code that selects these columns.

-- ── A. Clinic-level purchase controls ─────────────────────────────────────────
-- NOTE: phone_number_limit default (5) must match
-- billingConfig.productPolicy.defaultSelfServiceBusinessNumberLimit.
alter table public.clinics
  add column if not exists phone_number_purchases_enabled boolean not null default true,
  add column if not exists phone_number_limit integer not null default 5,
  add column if not exists phone_number_limit_updated_at timestamptz,
  add column if not exists phone_number_limit_updated_by_profile_id uuid,
  add column if not exists phone_number_purchase_suspended_reason text,
  add column if not exists stripe_base_subscription_item_id text,
  add column if not exists stripe_additional_number_subscription_item_id text,
  add column if not exists paid_plan_started_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinics_phone_number_limit_range_check') then
    alter table public.clinics
      add constraint clinics_phone_number_limit_range_check
      check (phone_number_limit >= 1 and phone_number_limit <= 100);
  end if;
end $$;

-- ── B. Per-number billing/audit snapshot on clinic_phone_numbers ──────────────
alter table public.clinic_phone_numbers
  add column if not exists source text not null default 'legacy',
  add column if not exists billing_class text not null default 'legacy',
  add column if not exists monthly_unit_amount_cents integer not null default 0,
  add column if not exists currency text not null default 'usd',
  add column if not exists purchased_by_profile_id uuid,
  add column if not exists purchased_by_email text,
  add column if not exists activated_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by_profile_id uuid,
  add column if not exists suspension_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_source_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_source_check
      check (source in ('legacy', 'owner_self_service', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_billing_class_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_billing_class_check
      check (billing_class in ('legacy', 'included', 'additional'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_currency_nonempty_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_currency_nonempty_check
      check (char_length(btrim(currency)) > 0);
  end if;
  -- legacy + included rows carry amount 0; additional rows carry amount > 0.
  -- (Legacy rows may be reclassified to 'additional' with an amount in a later
  -- reconciliation task; while they remain 'legacy' the amount stays 0.)
  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_billing_amount_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_billing_amount_check
      check (
        (billing_class in ('legacy', 'included') and monthly_unit_amount_cents = 0)
        or (billing_class = 'additional' and monthly_unit_amount_cents > 0)
      );
  end if;
end $$;

-- ── C. Durable purchase-attempt table ─────────────────────────────────────────
create table if not exists public.clinic_phone_number_purchase_attempts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requested_phone_number text not null,
  requested_by_profile_id uuid,
  requested_by_email text,
  source text not null,
  slot_class text not null,
  status text not null,
  twilio_phone_number_sid text,
  stripe_subscription_id text,
  stripe_additional_quantity_before integer,
  stripe_additional_quantity_after integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_phone_number_purchase_attempts_source_check
    check (source in ('owner_self_service', 'admin')),
  constraint clinic_phone_number_purchase_attempts_slot_class_check
    check (slot_class in ('included', 'additional')),
  constraint clinic_phone_number_purchase_attempts_status_check
    check (status in (
      'started', 'twilio_purchased', 'billing_pending', 'assigned',
      'failed', 'reconciliation_required', 'cancelled'
    ))
);

-- One in-progress attempt per clinic (serializes concurrent purchases).
create unique index if not exists clinic_pn_purchase_attempts_one_inflight_per_clinic_idx
  on public.clinic_phone_number_purchase_attempts (clinic_id)
  where status in ('started', 'twilio_purchased', 'billing_pending');

-- One in-progress attempt per phone number (no duplicate in-flight for a number).
create unique index if not exists clinic_pn_purchase_attempts_one_inflight_per_number_idx
  on public.clinic_phone_number_purchase_attempts (requested_phone_number)
  where status in ('started', 'twilio_purchased', 'billing_pending');

create index if not exists clinic_pn_purchase_attempts_clinic_created_idx
  on public.clinic_phone_number_purchase_attempts (clinic_id, created_at desc);

create index if not exists clinic_pn_purchase_attempts_number_idx
  on public.clinic_phone_number_purchase_attempts (requested_phone_number);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_pn_purchase_attempts_set_updated_at'
      and tgrelid = 'public.clinic_phone_number_purchase_attempts'::regclass
  ) then
    create trigger clinic_pn_purchase_attempts_set_updated_at
      before update on public.clinic_phone_number_purchase_attempts
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_phone_number_purchase_attempts enable row level security;
