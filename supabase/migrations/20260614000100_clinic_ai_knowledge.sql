-- AI Front Desk Knowledge foundation (account-side data model only).
--
-- Additive + idempotent. This migration stores clinic-approved answers that a
-- FUTURE AI front desk assistant may use with patients. It does not enable any
-- AI runtime, does not change Twilio/SMS behavior, and is not part of the SMS
-- approval/billing setup path.
--
-- Content rules for this table:
-- - No patient conversations, no PHI, no raw website HTML, no secrets, and no
--   AI provider prompts/responses are ever stored here.
-- - question_key/category/question always come from the committed catalog in
--   config/ai-front-desk-knowledge.config.ts (server-side), never from clients.
-- - source_type 'website_draft' is reserved for a future website parser that
--   will populate draft entries (source_url + source_excerpt) for owner review.

create table if not exists public.clinic_ai_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  question_key text not null,
  category text not null,
  question text not null,
  status text not null default 'not_found',
  answer text,
  source_type text not null default 'manual',
  source_url text,
  source_excerpt text,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_knowledge_entries_clinic_key_unique') then
    alter table public.clinic_ai_knowledge_entries
      add constraint clinic_ai_knowledge_entries_clinic_key_unique
      unique (clinic_id, question_key);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_knowledge_entries_status_check') then
    alter table public.clinic_ai_knowledge_entries
      add constraint clinic_ai_knowledge_entries_status_check
      check (status in ('not_found', 'needs_review', 'approved', 'handoff', 'do_not_answer'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_knowledge_entries_source_type_check') then
    alter table public.clinic_ai_knowledge_entries
      add constraint clinic_ai_knowledge_entries_source_type_check
      check (source_type in ('system_default', 'business_profile', 'website_draft', 'manual'));
  end if;
end $$;

create index if not exists clinic_ai_knowledge_entries_clinic_idx
  on public.clinic_ai_knowledge_entries (clinic_id);

create index if not exists clinic_ai_knowledge_entries_clinic_status_idx
  on public.clinic_ai_knowledge_entries (clinic_id, status);

create index if not exists clinic_ai_knowledge_entries_clinic_category_idx
  on public.clinic_ai_knowledge_entries (clinic_id, category);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_knowledge_entries_set_updated_at'
      and tgrelid = 'public.clinic_ai_knowledge_entries'::regclass
  ) then
    create trigger clinic_ai_knowledge_entries_set_updated_at
      before update on public.clinic_ai_knowledge_entries
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_ai_knowledge_entries enable row level security;
