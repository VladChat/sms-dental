-- Customer-facing phone-number removal lifecycle.
--
-- Additive + idempotent. This does not release, delete, rebill, or deactivate
-- any existing number when applied. Existing rows remain active/not_required.
-- Customer removal is a two-step lifecycle handled by app code:
--   active -> scheduled (immediately stops routing, billing sync no-proration)
--   scheduled -> permanently_removed/released (delayed Twilio release job)

-- Shared recurring Stripe item ids for local-number recurring billing. Local
-- one-time fees remain purchase-attempt specific and are not modeled here.
alter table public.clinics
  add column if not exists stripe_local_number_subscription_item_id text,
  add column if not exists stripe_local_sms_compliance_subscription_item_id text;

alter table public.clinic_phone_numbers
  add column if not exists removal_status text not null default 'active',
  add column if not exists removal_requested_at timestamptz,
  add column if not exists removal_requested_by_profile_id uuid,
  add column if not exists removal_requested_by_email text,
  add column if not exists permanent_removal_at timestamptz,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_profile_id uuid,
  add column if not exists restored_by_email text,
  add column if not exists twilio_released_at timestamptz,
  add column if not exists twilio_release_status text not null default 'not_required',
  add column if not exists twilio_release_error text;

update public.clinic_phone_numbers
set
  removal_status = coalesce(removal_status, 'active'),
  twilio_release_status = coalesce(twilio_release_status, 'not_required')
where removal_status is null
   or twilio_release_status is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_removal_status_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_removal_status_check
      check (removal_status in ('active', 'scheduled', 'permanently_removed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_twilio_release_status_check') then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_twilio_release_status_check
      check (twilio_release_status in ('not_required', 'pending', 'released', 'failed'));
  end if;
end $$;

create index if not exists clinic_phone_numbers_removal_scheduled_idx
  on public.clinic_phone_numbers (clinic_id, permanent_removal_at)
  where removal_status = 'scheduled';

create index if not exists clinic_phone_numbers_due_release_idx
  on public.clinic_phone_numbers (permanent_removal_at)
  where removal_status = 'scheduled'
    and twilio_release_status in ('pending', 'failed');
