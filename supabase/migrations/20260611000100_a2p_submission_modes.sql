-- A2P submission mode separation for live vs mock attempts.
--
-- Additive + safe. Preserves the existing live failed Brand state while
-- allowing separate mock and dry-run attempts per clinic.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'clinic_a2p_submissions_clinic_unique'
      and conrelid = 'public.clinic_a2p_submissions'::regclass
  ) then
    alter table public.clinic_a2p_submissions
      drop constraint clinic_a2p_submissions_clinic_unique;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'clinic_a2p_submissions_mode_check'
      and conrelid = 'public.clinic_a2p_submissions'::regclass
  ) then
    alter table public.clinic_a2p_submissions
      drop constraint clinic_a2p_submissions_mode_check;
  end if;
end $$;

alter table public.clinic_a2p_submissions
  add constraint clinic_a2p_submissions_mode_check
  check (submission_mode in ('disabled', 'dry_run', 'mock', 'live'));

alter table public.clinic_a2p_submissions
  add constraint clinic_a2p_submissions_clinic_mode_unique
  unique (clinic_id, submission_mode);

create index if not exists clinic_a2p_submissions_clinic_mode_idx
  on public.clinic_a2p_submissions (clinic_id, submission_mode);
