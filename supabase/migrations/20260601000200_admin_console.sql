-- Platform admin console — audit log + internal admin fields on clinics.
--
-- Additive + idempotent. No data is reset, deleted, rewritten, or backfilled.
-- Apply via Supabase SQL editor or the Management API after owner approval.
--
-- Redaction rule for admin_audit_events: before_state/after_state/metadata hold
-- only redacted, non-secret field snapshots (e.g. is_active, sms_recovery_enabled,
-- note text). NEVER store secrets, raw setup/recovery tokens, or raw webhook
-- payloads.

-- Internal-only operator fields on clinics (never shown to clinic owner / front
-- desk). Length-capped to keep notes small.
alter table public.clinics
  add column if not exists admin_internal_note text,
  add column if not exists admin_provisioning_status text,
  add column if not exists admin_provisioning_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinics_admin_provisioning_status_check') then
    alter table public.clinics
      add constraint clinics_admin_provisioning_status_check
      check (admin_provisioning_status is null or admin_provisioning_status in
        ('none', 'review_needed', 'in_review', 'cleared', 'blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinics_admin_internal_note_len_check') then
    alter table public.clinics
      add constraint clinics_admin_internal_note_len_check
      check (admin_internal_note is null or char_length(admin_internal_note) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinics_admin_provisioning_note_len_check') then
    alter table public.clinics
      add constraint clinics_admin_provisioning_note_len_check
      check (admin_provisioning_note is null or char_length(admin_provisioning_note) <= 1000);
  end if;
end $$;

-- Append-only audit of every platform-admin write action.
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  clinic_id uuid references public.clinics(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);
create index if not exists admin_audit_events_admin_email_idx
  on public.admin_audit_events (admin_email, created_at desc);
create index if not exists admin_audit_events_clinic_idx
  on public.admin_audit_events (clinic_id, created_at desc);
create index if not exists admin_audit_events_target_idx
  on public.admin_audit_events (target_type, target_id);

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.admin_audit_events enable row level security;
