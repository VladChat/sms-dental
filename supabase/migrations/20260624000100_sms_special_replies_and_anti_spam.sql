-- SMS special replies (safety notice / thanks courtesy overrides) and simple
-- anti-spam automation-pause settings.
--
-- Additive + idempotent. Nothing here sends SMS or changes send gates:
--   - template_role='special_reply' rows store ONLY custom overrides
--     (sequence 1 = safety_notice, 2 = thanks_courtesy); no row / NULL body
--     means the current code default.
--   - clinic_sms_conversation_settings gains nullable anti-spam thresholds;
--     NULL means the code defaults (mute after 6 unanswered, high-volume flag
--     after 10, 24-hour pause).
--   - patient_conversations gains per-conversation volume state. Inbound
--     messages are always still recorded; the mute only pauses automated
--     replies temporarily and never blocks the number.

-- 1. Allow the special_reply template role (sequence 1-2).
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'clinic_sms_message_templates_role_check'
      and conrelid = 'public.clinic_sms_message_templates'::regclass
  ) then
    alter table public.clinic_sms_message_templates
      drop constraint clinic_sms_message_templates_role_check;
  end if;

  alter table public.clinic_sms_message_templates
    add constraint clinic_sms_message_templates_role_check
    check (template_role in ('initial', 'auto_reply', 'voice_greeting', 'special_reply'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'clinic_sms_message_templates_sequence_check'
      and conrelid = 'public.clinic_sms_message_templates'::regclass
  ) then
    alter table public.clinic_sms_message_templates
      drop constraint clinic_sms_message_templates_sequence_check;
  end if;

  alter table public.clinic_sms_message_templates
    add constraint clinic_sms_message_templates_sequence_check
    check (
      (template_role = 'initial' and sequence = 0)
      or (template_role = 'auto_reply' and sequence between 1 and 10)
      or (template_role = 'voice_greeting' and sequence between 1 and 3)
      or (template_role = 'special_reply' and sequence between 1 and 2)
    );
end $$;

-- 2. Anti-spam thresholds (NULL = code default). The cross-column rule
--    (high_volume_after >= mute_after) is enforced by server validation;
--    the DB keeps simple per-column range checks.
alter table public.clinic_sms_conversation_settings
  add column if not exists unanswered_mute_after int,
  add column if not exists unanswered_high_volume_after int,
  add column if not exists automation_mute_hours int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_sms_conversation_settings_anti_spam_check'
      and conrelid = 'public.clinic_sms_conversation_settings'::regclass
  ) then
    alter table public.clinic_sms_conversation_settings
      add constraint clinic_sms_conversation_settings_anti_spam_check
      check (
        (unanswered_mute_after is null or unanswered_mute_after between 1 and 100)
        and (unanswered_high_volume_after is null or unanswered_high_volume_after between 1 and 200)
        and (automation_mute_hours is null or automation_mute_hours between 1 and 168)
      );
  end if;
end $$;

-- 3. Per-conversation automation volume state.
alter table public.patient_conversations
  add column if not exists unanswered_after_automation_count int not null default 0,
  add column if not exists automation_muted_until timestamptz,
  add column if not exists high_volume_flagged_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_conversations_unanswered_count_check'
      and conrelid = 'public.patient_conversations'::regclass
  ) then
    alter table public.patient_conversations
      add constraint patient_conversations_unanswered_count_check
      check (unanswered_after_automation_count >= 0);
  end if;
end $$;
