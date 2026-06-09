-- Twilio billing anchor for the phone-number removal lifecycle.
--
-- Additive + idempotent. Adds clinic_phone_numbers.twilio_purchased_at, the
-- timestamp we use as the estimated Twilio monthly-renewal billing anchor when
-- scheduling a permanent removal (release ~1 day before the estimated renewal
-- anniversary). New rows store Twilio's IncomingPhoneNumber dateCreated (or a
-- safe fallback). Existing rows are backfilled to coalesce(activated_at,
-- created_at).
--
-- Intentionally NULLABLE: removal-lifecycle code falls back to created_at when
-- twilio_purchased_at is null, so a missing value never blocks the lifecycle.
-- No data is released, rebilled, deactivated, or reclassified by this migration.

alter table public.clinic_phone_numbers
  add column if not exists twilio_purchased_at timestamptz;

update public.clinic_phone_numbers
  set twilio_purchased_at = coalesce(activated_at, created_at)
  where twilio_purchased_at is null;
