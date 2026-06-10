-- Per-phone-number texting approval/capability status.
--
-- Additive + conservative. This separates a number's texting approval state
-- from its routing/lifecycle state (`is_active`, `removal_status`) and from the
-- clinic-level A2P workflow state (`clinics.sms_status`).
--
-- Existing rows default to `waiting_for_approval`. Existing LOCAL numbers may be
-- initialized from `clinics.sms_status` because that clinic-level field is the
-- current local/A2P workflow approximation. Existing TOLL-FREE numbers are NOT
-- marked active here: toll-free verification is number-specific and must be
-- confirmed by a reliable Twilio/operator source before activation.

alter table public.clinic_phone_numbers
  add column if not exists texting_status text not null default 'waiting_for_approval',
  add column if not exists texting_status_source text not null default 'system',
  add column if not exists texting_status_updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_phone_numbers_texting_status_check'
      and conrelid = 'public.clinic_phone_numbers'::regclass
  ) then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_texting_status_check
      check (texting_status in ('preparing', 'waiting_for_approval', 'active', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_phone_numbers_texting_status_source_check'
      and conrelid = 'public.clinic_phone_numbers'::regclass
  ) then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_texting_status_source_check
      check (length(btrim(texting_status_source)) > 0);
  end if;
end $$;

-- Conservative local-only backfill from the clinic-level A2P workflow status.
-- Toll-free rows intentionally remain `waiting_for_approval` unless a separate
-- number-specific verification source updates them later.
update public.clinic_phone_numbers cpn
set
  texting_status = c.sms_status,
  texting_status_source = 'clinic_sms_status_backfill',
  texting_status_updated_at = now()
from public.clinics c
where cpn.clinic_id = c.id
  and cpn.number_type = 'local'
  and c.sms_status in ('preparing', 'waiting_for_approval', 'active')
  and cpn.texting_status = 'waiting_for_approval'
  and cpn.texting_status_source = 'system';
