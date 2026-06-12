-- Safety-aware SMS replies: one-time-per-cycle safety notice marker, plus a
-- data-only cleanup so default-backed Follow-up #1 rows pick up the new code
-- default (which now also asks for a preferred appointment time).
--
-- Additive + idempotent. Nothing here sends SMS or changes send gates. The
-- safety notice marker is reset by the existing auto-reply cycle reset when a
-- new missed-call recovery SMS starts a cycle. patient_display_name is not
-- touched.

-- 1. One conditional "If this is a medical emergency, call 911." prefix is
--    allowed per recovery cycle; this timestamp is its atomic claim marker.
alter table public.patient_conversations
  add column if not exists sms_safety_notice_sent_at timestamptz;

-- 2. Data-only Follow-up #1 default cleanup. Code defaults are the source of
--    truth and body_text = NULL means "current code default". Old saved
--    default-like Follow-up #1 bodies are cleared to NULL so those clinics use
--    the new default copy. Enabled flags and true custom text are preserved.
update public.clinic_sms_message_templates
set body_text = null
where template_role = 'auto_reply'
  and sequence = 1
  and body_text is not null
  and btrim(body_text) in (
    'Thanks for the info. What name should we use when our office follows up?',
    'Thanks. What name should we use when our office follows up?',
    'Got it. What name should we use when our office follows up?',
    'Got it. What name should we use when the office follows up?',
    'Thanks for the info. What name should we use when our office follows up? If you''re looking for an appointment, what time works best for you?'
  );
