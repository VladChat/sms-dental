-- AI Answering foundation (NON-LIVE).
--
-- This migration only lets the system REPRESENT AI answered calls in the
-- database and Workspace. It does NOT enable any live AI behavior: there is no
-- AI voice runtime, no Twilio ConversationRelay, no OpenAI, and no SMS send tied
-- to these tables. Do not apply to production without explicit owner approval.
--
-- Two clinic-scoped tables:
--
--   clinic_ai_answering_settings — a foundation row for future AI Answering
--     settings (currently only a future AI voice preference). There is NO
--     customer-facing "enable AI" switch and no live-enablement column.
--
--   ai_voice_sessions — one row per AI answered call session. Today the only
--     producer is the platform-admin mock route; `future_twilio` is reserved for
--     the not-yet-built live runtime.
--
-- Privacy / minimum-necessary: these tables store only the narrow request
-- capture (name, reason, preferred time, a short summary/handoff note, and a
-- safety flag). They MUST NOT store full transcripts, audio, raw AI prompts or
-- responses, raw Twilio payloads, OpenAI request/response bodies, secrets,
-- payment data, or diagnosis/treatment text.
--
-- Safety: clinic-scoped, RLS enabled, NO public policies — server route handlers
-- reach these via the service-role DB URL like other internal clinic-scoped
-- tables. Idempotent and additive (create-if-not-exists; no drops/deletes).

-- --------------------------------------------------------------------------
-- clinic_ai_answering_settings (one row per clinic; foundation only).
-- --------------------------------------------------------------------------

create table if not exists public.clinic_ai_answering_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  -- Future AI voice preference. Validated against the curated voice list in
  -- config/voice-greeting.config.ts by the server helper, not by a DB enum.
  selected_voice_id text not null default 'google-leda',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_profile_id uuid,
  updated_by_email text
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_answering_settings_set_updated_at'
      and tgrelid = 'public.clinic_ai_answering_settings'::regclass
  ) then
    create trigger clinic_ai_answering_settings_set_updated_at
      before update on public.clinic_ai_answering_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_ai_answering_settings enable row level security;

-- --------------------------------------------------------------------------
-- ai_voice_sessions (one row per AI answered call session).
-- --------------------------------------------------------------------------

create table if not exists public.ai_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.patient_conversations(id) on delete set null,
  call_event_id uuid references public.call_events(id) on delete set null,
  source text not null default 'mock',
  external_session_id text,
  patient_phone text not null,
  clinic_phone text,
  status text not null,
  captured_patient_name text,
  captured_reason text,
  captured_preferred_time text,
  summary_headline text,
  handoff_note text,
  safety_signal boolean not null default false,
  sms_followup_recommended boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_voice_sessions_source_check
    check (source in ('mock', 'future_twilio')),
  constraint ai_voice_sessions_status_check
    check (status in ('captured', 'incomplete', 'failed')),
  constraint ai_voice_sessions_name_len_check
    check (captured_patient_name is null or char_length(captured_patient_name) <= 80),
  constraint ai_voice_sessions_reason_len_check
    check (captured_reason is null or char_length(captured_reason) <= 240),
  constraint ai_voice_sessions_preferred_time_len_check
    check (captured_preferred_time is null or char_length(captured_preferred_time) <= 120),
  constraint ai_voice_sessions_summary_len_check
    check (summary_headline is null or char_length(summary_headline) <= 240),
  constraint ai_voice_sessions_handoff_len_check
    check (handoff_note is null or char_length(handoff_note) <= 500),
  constraint ai_voice_sessions_patient_phone_len_check
    check (char_length(patient_phone) <= 32),
  constraint ai_voice_sessions_clinic_phone_len_check
    check (clinic_phone is null or char_length(clinic_phone) <= 32),
  constraint ai_voice_sessions_external_id_len_check
    check (external_session_id is null or char_length(external_session_id) <= 200)
);

-- Idempotency for a real provider later: at most one session per
-- (clinic, source, external_session_id) when an external id is present.
create unique index if not exists ai_voice_sessions_external_id_key
  on public.ai_voice_sessions (clinic_id, source, external_session_id)
  where external_session_id is not null;

create index if not exists ai_voice_sessions_clinic_created_idx
  on public.ai_voice_sessions (clinic_id, created_at desc);

create index if not exists ai_voice_sessions_conversation_created_idx
  on public.ai_voice_sessions (conversation_id, created_at desc);

create index if not exists ai_voice_sessions_patient_idx
  on public.ai_voice_sessions (clinic_id, patient_phone, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'ai_voice_sessions_set_updated_at'
      and tgrelid = 'public.ai_voice_sessions'::regclass
  ) then
    create trigger ai_voice_sessions_set_updated_at
      before update on public.ai_voice_sessions
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.ai_voice_sessions enable row level security;
