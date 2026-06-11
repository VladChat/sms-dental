-- AI Knowledge per-section review state.
--
-- Each owner-reviewable AI Knowledge section (hours, insurance, services,
-- languages, payment_methods, financing, office_policies) gets one row here
-- when the owner saves it. The owner UI shows "Needs review" until the row
-- exists and "Complete" after, and the state survives reloads. Website-scan
-- drafts delete the affected section's row so it re-opens for review.
--
-- Read-only blocks (business profile facts, website loader) and the removed
-- Appointments owner UI are intentionally NOT reviewable here.
--
-- Still foundation-only: no AI runtime reads this table, no Twilio/SMS
-- behavior changes, no PHI / raw HTML / secrets stored.

create table if not exists public.clinic_ai_knowledge_section_reviews (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  section_key text not null,
  reviewed_at timestamptz not null default now(),
  reviewed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clinic_id, section_key)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_ai_section_reviews_key_check') then
    alter table public.clinic_ai_knowledge_section_reviews
      add constraint clinic_ai_section_reviews_key_check
      check (section_key in (
        'hours', 'insurance', 'services', 'languages',
        'payment_methods', 'financing', 'office_policies'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clinic_ai_knowledge_section_reviews_set_updated_at'
      and tgrelid = 'public.clinic_ai_knowledge_section_reviews'::regclass
  ) then
    create trigger clinic_ai_knowledge_section_reviews_set_updated_at
      before update on public.clinic_ai_knowledge_section_reviews
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (server route handlers via SUPABASE_DB_URL). No policies.
alter table public.clinic_ai_knowledge_section_reviews enable row level security;
