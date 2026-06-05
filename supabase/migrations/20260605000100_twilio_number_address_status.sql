-- Persist Twilio address / emergency-address setup metadata for purchased
-- clinic phone numbers.
--
-- Additive only: no existing Twilio numbers, SMS settings, billing state, or
-- clinic data is modified by this migration.

alter table public.clinic_phone_numbers
  add column if not exists twilio_address_sid text,
  add column if not exists twilio_emergency_address_sid text,
  add column if not exists twilio_emergency_address_status text,
  add column if not exists twilio_address_configured_at timestamptz;

