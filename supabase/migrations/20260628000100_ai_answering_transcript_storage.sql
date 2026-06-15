-- AI Answering transcript storage (additive).
--
-- Stores only normalized text turns for each AI answered call session. No audio,
-- raw provider payloads, raw prompts, secrets, payment data, or provider IDs are
-- added by this migration. Transcript cleanup is a future operational task; this
-- migration records a per-session expiry timestamp for safe retention handling.

alter table public.ai_voice_sessions
  add column if not exists transcript_turns jsonb,
  add column if not exists transcript_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_voice_sessions_transcript_turns_array_check'
      and conrelid = 'public.ai_voice_sessions'::regclass
  ) then
    alter table public.ai_voice_sessions
      add constraint ai_voice_sessions_transcript_turns_array_check
      check (transcript_turns is null or jsonb_typeof(transcript_turns) = 'array');
  end if;
end $$;

create index if not exists ai_voice_sessions_conversation_completed_idx
  on public.ai_voice_sessions (clinic_id, conversation_id, completed_at desc, created_at desc)
  where conversation_id is not null;
