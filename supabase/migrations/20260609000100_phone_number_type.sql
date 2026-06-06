-- Toll-free vs Local number model: durable number_type classification.
--
-- Additive + idempotent. No data is reset, deleted, released, rebilled, or
-- reclassified for billing. This ONLY records what KIND of number each row is
-- (toll_free vs local), which drives display, entitlement, and the approval path
-- (local -> A2P 10DLC; toll-free -> toll-free verification). Existing billing_class
-- and Stripe quantities are left untouched (no rebilling).
--
-- Conservative default: 'local'. Local is the more restrictive path (always a
-- paid add-on, requires A2P). Defaulting unknown rows / forgotten inserts to
-- 'local' can never silently grant a "first toll-free included" benefit, so the
-- failure direction is always safe. New code always sets number_type explicitly.

-- ── A. clinic_phone_numbers.number_type ───────────────────────────────────────
alter table public.clinic_phone_numbers
  add column if not exists number_type text;

-- Backfill the two known Fairstone production numbers as LOCAL (matched by both
-- phone number AND Twilio SID so the update is exact).
update public.clinic_phone_numbers
  set number_type = 'local'
  where number_type is null
    and (
      (phone_number = '+12244009986' and twilio_phone_number_sid = 'PNcfa04ebbb3c99d346473979781eb8785')
      or (phone_number = '+12243442685' and twilio_phone_number_sid = 'PN04b5bd6be9a95f26412c58bafea04512')
    );

-- Numbers with a well-known NANP toll-free area code are SAFELY known to be
-- toll-free (e.g. the platform number +18447234944 on the seed clinic). Classify
-- those as 'toll_free' rather than defaulting them to 'local'.
update public.clinic_phone_numbers
  set number_type = 'toll_free'
  where number_type is null
    and phone_number ~ '^\+1(800|833|844|855|866|877|888)';

-- Conservative backfill: any remaining unknown existing row -> 'local'
-- (never silently 'toll_free', which would imply included / no-A2P).
update public.clinic_phone_numbers
  set number_type = 'local'
  where number_type is null;

-- Enforce going forward: NOT NULL with a safe default + value check.
alter table public.clinic_phone_numbers
  alter column number_type set default 'local',
  alter column number_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinic_phone_numbers_number_type_check'
  ) then
    alter table public.clinic_phone_numbers
      add constraint clinic_phone_numbers_number_type_check
      check (number_type in ('toll_free', 'local'));
  end if;
end $$;

-- ── B. clinic_phone_number_purchase_attempts.requested_number_type ─────────────
alter table public.clinic_phone_number_purchase_attempts
  add column if not exists requested_number_type text;

-- Backfill historical attempts conservatively to 'local'.
update public.clinic_phone_number_purchase_attempts
  set requested_number_type = 'local'
  where requested_number_type is null;

alter table public.clinic_phone_number_purchase_attempts
  alter column requested_number_type set default 'local',
  alter column requested_number_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_pn_purchase_attempts_requested_number_type_check'
  ) then
    alter table public.clinic_phone_number_purchase_attempts
      add constraint clinic_pn_purchase_attempts_requested_number_type_check
      check (requested_number_type in ('toll_free', 'local'));
  end if;
end $$;
