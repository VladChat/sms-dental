-- Clean stale SMS Conversation Builder default-like template overrides.
--
-- Data-only and idempotent. Code defaults are the source of truth; rows with
-- body_text = NULL are default-backed. This migration removes old saved
-- default-like initial/voice overrides and clears old saved default-like
-- follow-up bodies while preserving follow-up enabled flags and true custom
-- text.

delete from public.clinic_sms_message_templates
where template_role = 'initial'
  and sequence = 0
  and body_text is not null
  and btrim(body_text) in (
    'Hi, this is {{clinic_name}}. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.',
    'Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.'
  );

update public.clinic_sms_message_templates
set body_text = null
where template_role = 'auto_reply'
  and sequence = 1
  and body_text is not null
  and btrim(body_text) in (
    'Thanks. What name should we use when our office follows up?',
    'Got it. What name should we use when our office follows up?',
    'Got it. What name should we use when the office follows up?',
    'Thanks for the info. What name should we use when our office follows up?'
  );

update public.clinic_sms_message_templates
set body_text = null
where template_role = 'auto_reply'
  and sequence = 2
  and body_text is not null
  and btrim(body_text) in (
    'Thanks, {{patient_name}}. I’ll pass this to the office so they can follow up.',
    'Thanks, {{patient_name}}. I''ll pass this to the office so they can follow up.',
    'Thanks, {{patient_name}}. I''ll pass this to the office. They contact you ASAP.',
    'Thanks, {{patient_name}}. I''ll pass this to our team so they can follow up.'
  );

update public.clinic_sms_message_templates
set body_text = null
where template_role = 'auto_reply'
  and sequence = 3
  and body_text is not null
  and btrim(body_text) in (
    'Got it. We’ll include that note for the office.',
    'Got it. We''ll include that note for the office.',
    'Noted. We''ll include that note for the office.',
    'Got it. We''ll pass that along to our team.'
  );

delete from public.clinic_sms_message_templates
where template_role = 'voice_greeting'
  and sequence = 1
  and body_text is not null
  and btrim(body_text) in (
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed you. We''ll send you a text now, so our team can follow up.',
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed you. We''ll send you a text now so our team can follow up.'
  );

delete from public.clinic_sms_message_templates
where template_role = 'voice_greeting'
  and sequence = 2
  and body_text is not null
  and btrim(body_text) in (
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed your call. Our team will follow up shortly.',
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed you. Our team will follow up shortly.',
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed you. We already sent a text, and our team will follow up shortly.'
  );

delete from public.clinic_sms_message_templates
where template_role = 'voice_greeting'
  and sequence = 3
  and body_text is not null
  and btrim(body_text) in (
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed your call. Our team will follow up shortly.',
    'Hi, thanks for calling {{clinic_name}}. We''re sorry we missed you. Our team will follow up shortly.'
  );
