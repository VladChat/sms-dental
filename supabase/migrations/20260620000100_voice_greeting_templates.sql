-- Voice greeting templates for the SMS Conversation Builder.
--
-- Additive + idempotent. Reuses public.clinic_sms_message_templates with
-- template_role='voice_greeting':
--   sequence 1 = will_send
--   sequence 2 = duplicate
--   sequence 3 = none
--
-- Safety: this only widens constraints so platform-admin-configured voice
-- greeting text can be stored. Voice TwiML/Say/Hangup behavior remains
-- system-controlled in code, and no provider resources are mutated here.

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
    check (template_role in ('initial', 'auto_reply', 'voice_greeting'));
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
      or (template_role = 'auto_reply' and sequence between 1 and 3)
      or (template_role = 'voice_greeting' and sequence between 1 and 3)
    );
end $$;
