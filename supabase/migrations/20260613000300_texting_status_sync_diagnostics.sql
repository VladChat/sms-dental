-- Provider diagnostics for automatic per-phone-number texting-status sync.
--
-- Additive + conservative. These columns store safe provider status/error
-- summaries from read-only Twilio syncs. They do not affect routing, billing,
-- number lifecycle, Twilio release, or SMS sending by themselves.

alter table public.clinic_phone_numbers
  add column if not exists texting_provider_status text,
  add column if not exists texting_provider_error_code text,
  add column if not exists texting_provider_error_message text,
  add column if not exists texting_provider_synced_at timestamptz;

create index if not exists clinic_phone_numbers_texting_status_due_idx
  on public.clinic_phone_numbers (texting_status, texting_status_updated_at, created_at)
  where is_active = true and removal_status = 'active';

create index if not exists clinic_phone_numbers_texting_sync_clinic_idx
  on public.clinic_phone_numbers (clinic_id, texting_status_updated_at)
  where is_active = true and removal_status = 'active';
