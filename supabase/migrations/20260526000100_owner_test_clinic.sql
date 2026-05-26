-- Seed: owner-test clinic and Twilio phone number mapping.
--
-- This clinic is used exclusively for owner/developer SMS testing while
-- SMS_RECOVERY_MODE=owner_test. It is NOT a real patient-facing clinic.
-- Remove or replace this row when a real clinic onboarding flow is in place.
--
-- Safe to apply multiple times (all inserts use ON CONFLICT DO NOTHING).

insert into public.clinics (name, slug, timezone, is_active)
values ('Owner Test Dental Office', 'owner-test', 'America/Chicago', true)
on conflict (slug) do nothing;

insert into public.clinic_phone_numbers
  (clinic_id, phone_number, twilio_phone_number_sid, role, is_active)
select
  c.id,
  '+18447234944',
  'PN3d6d4c7f327b299a4b04e4bd7e05a402',
  'recovery',
  true
from public.clinics c
where c.slug = 'owner-test'
on conflict (phone_number) do nothing;
