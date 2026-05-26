-- Per-clinic SMS recovery safety gate.
--
-- In live mode, sendRecoverySms checks sms_recovery_enabled before sending.
-- Default false: new clinics do NOT send recovery SMS until explicitly enabled.
-- In owner_test mode, the allowlist remains the gate; this column is not checked.
--
-- Apply via Supabase SQL editor or admin DB connection after owner approval.

alter table public.clinics
  add column if not exists sms_recovery_enabled boolean not null default false;

-- Owner Test Dental Office is already fully verified. Keep its behavior intact.
update public.clinics
  set sms_recovery_enabled = true
  where slug = 'owner-test';
