-- SMS Conversation Builder v1 (admin-configured deterministic SMS flow).
--
-- Additive + idempotent. Adds platform-admin-configurable conversation
-- settings and message templates for a clinic, plus conversation-level
-- auto-reply state and a message_kind classifier on messages.
--
-- Safety: nothing here sends SMS or changes existing behavior. With no rows in
-- clinic_sms_conversation_settings, max_auto_replies defaults to 0 and the
-- missed-call recovery SMS keeps using its fixed template. These templates are
-- deterministic copy only — no AI, no patient data, no secrets stored here.

-- 1. Per-clinic conversation settings (one row per clinic). max_auto_replies
--    gates how many deterministic follow-ups may be sent (0 disables them).
create table if not exists public.clinic_sms_conversation_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  max_auto_replies int not null default 0,
  updated_by_profile_id uuid,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_conversation_settings_max_check') then
    alter table public.clinic_sms_conversation_settings
      add constraint clinic_sms_conversation_settings_max_check
      check (max_auto_replies between 0 and 3);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_sms_conversation_settings_set_updated_at'
      and tgrelid = 'public.clinic_sms_conversation_settings'::regclass
  ) then
    create trigger clinic_sms_conversation_settings_set_updated_at
      before update on public.clinic_sms_conversation_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 2. Per-clinic message templates.
--    template_role 'initial' (sequence 0): editable MIDDLE text only; the clinic
--      identity prefix and "Reply STOP to opt out." suffix are added in code and
--      cannot be stored/removed here.
--    template_role 'auto_reply' (sequence 1..3): full deterministic follow-up
--      body sent after the 1st/2nd/3rd patient reply, when enabled and allowed.
create table if not exists public.clinic_sms_message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  template_role text not null,
  sequence int not null,
  body_text text,
  enabled boolean not null default true,
  updated_by_profile_id uuid,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_message_templates_clinic_role_seq_unique') then
    alter table public.clinic_sms_message_templates
      add constraint clinic_sms_message_templates_clinic_role_seq_unique
      unique (clinic_id, template_role, sequence);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_message_templates_role_check') then
    alter table public.clinic_sms_message_templates
      add constraint clinic_sms_message_templates_role_check
      check (template_role in ('initial', 'auto_reply'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_message_templates_sequence_check') then
    alter table public.clinic_sms_message_templates
      add constraint clinic_sms_message_templates_sequence_check
      check (
        (template_role = 'initial' and sequence = 0)
        or (template_role = 'auto_reply' and sequence between 1 and 3)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_sms_message_templates_body_len_check') then
    alter table public.clinic_sms_message_templates
      add constraint clinic_sms_message_templates_body_len_check
      check (body_text is null or length(body_text) <= 240);
  end if;
end $$;

create index if not exists clinic_sms_message_templates_lookup_idx
  on public.clinic_sms_message_templates (clinic_id, template_role, sequence);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_sms_message_templates_set_updated_at'
      and tgrelid = 'public.clinic_sms_message_templates'::regclass
  ) then
    create trigger clinic_sms_message_templates_set_updated_at
      before update on public.clinic_sms_message_templates
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 3. Conversation-level state for deterministic auto-replies + a safely-collected
--    patient display name (first name volunteered by the patient; not PHI).
alter table public.patient_conversations
  add column if not exists patient_display_name text,
  add column if not exists sms_auto_reply_count int not null default 0,
  add column if not exists sms_auto_reply_last_sent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patient_conversations_display_name_len_check') then
    alter table public.patient_conversations
      add constraint patient_conversations_display_name_len_check
      check (patient_display_name is null or length(patient_display_name) <= 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'patient_conversations_auto_reply_count_check') then
    alter table public.patient_conversations
      add constraint patient_conversations_auto_reply_count_check
      check (sms_auto_reply_count >= 0);
  end if;
end $$;

-- 4. Message kind classifier. Existing rows stay null and are treated as
--    missed-call recovery / inbound by direction (backward compatible).
alter table public.messages
  add column if not exists message_kind text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_message_kind_check') then
    alter table public.messages
      add constraint messages_message_kind_check
      check (message_kind is null or message_kind in (
        'missed_call_recovery', 'conversation_auto_reply', 'manual', 'inbound'
      ));
  end if;
end $$;

create index if not exists messages_conversation_kind_idx
  on public.messages (conversation_id, message_kind, created_at desc);

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_sms_conversation_settings enable row level security;
alter table public.clinic_sms_message_templates enable row level security;
