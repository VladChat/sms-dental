-- A2P submission state-machine progress.
--
-- Additive + idempotent. Adds resumable progress tracking to the existing
-- public.clinic_a2p_submissions table so a single platform-admin "Submit" can
-- run every currently-allowed Twilio A2P step, persist after each one, and be
-- safely retried/resumed if a later step is pending or fails.
--
-- No destructive SQL. No existing data rewrite. The existing resource-SID,
-- status, error, and snapshot columns are reused. `provider_state` is a redacted
-- jsonb bag of intermediate Trust Hub SIDs / per-step statuses (NEVER the full
-- EIN/tax id, secrets, or patient data).

alter table public.clinic_a2p_submissions
  add column if not exists submission_step text;

alter table public.clinic_a2p_submissions
  add column if not exists provider_state jsonb not null default '{}'::jsonb;
