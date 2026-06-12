-- Expand deterministic SMS Conversation Builder follow-ups and thanks courtesy state.
--
-- Additive + idempotent. This widens admin-configured auto-reply slots from
-- 1..3 to 1..10 while leaving voice greetings at 1..3, and adds a per-cycle
-- timestamp for the one allowed deterministic thanks courtesy reply.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'clinic_sms_conversation_settings_max_check'
      and conrelid = 'public.clinic_sms_conversation_settings'::regclass
  ) then
    alter table public.clinic_sms_conversation_settings
      drop constraint clinic_sms_conversation_settings_max_check;
  end if;

  alter table public.clinic_sms_conversation_settings
    add constraint clinic_sms_conversation_settings_max_check
    check (max_auto_replies between 0 and 10);
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
    );
end $$;

alter table public.patient_conversations
  add column if not exists sms_thanks_courtesy_sent_at timestamptz;
