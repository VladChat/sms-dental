-- Platform-admin "Detach from clinic" lifecycle state.
--
-- Additive + idempotent. Adds a new explicit `detached` value to the
-- clinic_phone_numbers.removal_status check constraint. A detached row keeps the
-- Twilio number owned in our Twilio account (NO Twilio release) and its clinic
-- assignment is released only at the application layer (the row is filtered out
-- of the old clinic's lists and counts). Detach is semantically distinct from
-- `permanently_removed`, which means a completed Twilio release / historical
-- lifecycle and must never be used for detach.
--
-- This migration does not release, delete, rebill, deactivate, or detach any
-- existing number when applied. It only widens the allowed value set.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'clinic_phone_numbers_removal_status_check') then
    alter table public.clinic_phone_numbers
      drop constraint clinic_phone_numbers_removal_status_check;
  end if;

  alter table public.clinic_phone_numbers
    add constraint clinic_phone_numbers_removal_status_check
    check (removal_status in ('active', 'scheduled', 'permanently_removed', 'detached'));
end $$;
