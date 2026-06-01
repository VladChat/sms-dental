-- Front-desk workspace outcome fields on patient_conversations.
--
-- Lets the front desk record the result of a missed-call patient request.
-- Additive only: three nullable columns plus value/length check constraints.
-- No data is reset, deleted, rewritten, or backfilled. Idempotent: safe to
-- re-run (uses `add column if not exists` and guards the constraint adds).
--
-- Status mapping applied by the app when an outcome is saved
-- (patient_conversations.status check is open|closed|booked|lost):
--   appointment_booked      -> status 'booked'
--   no_appointment_booked   -> status 'lost'
--   could_not_reach_patient -> status 'closed'

alter table public.patient_conversations
  add column if not exists front_desk_outcome text,
  add column if not exists front_desk_note text,
  add column if not exists front_desk_outcome_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_conversations_front_desk_outcome_check'
  ) then
    alter table public.patient_conversations
      add constraint patient_conversations_front_desk_outcome_check
      check (
        front_desk_outcome is null
        or front_desk_outcome in (
          'appointment_booked',
          'no_appointment_booked',
          'could_not_reach_patient'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_conversations_front_desk_note_len_check'
  ) then
    alter table public.patient_conversations
      add constraint patient_conversations_front_desk_note_len_check
      check (front_desk_note is null or char_length(front_desk_note) <= 300);
  end if;
end $$;
