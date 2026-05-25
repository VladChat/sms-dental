-- Backend Foundation v1 — initial schema for Missed Calls Dental.
--
-- Design principles:
--   - Multi-tenant by clinic_id. RLS is enabled but no per-role policies are
--     defined in this migration. The first messaging milestone will add
--     policies once we know which roles (anon / authenticated / service_role)
--     touch which tables. Until then, only the service role (used by
--     server-side route handlers with SUPABASE_DB_URL) can access these tables.
--   - PHI minimization. We deliberately do NOT store patient names in this
--     milestone. Identifiers are phone numbers in E.164 form plus opaque
--     Twilio SIDs. Patient-facing fields can be added later when the dashboard
--     justifies them.
--   - Idempotency. Every external event ingress has a unique key:
--       webhook_events(provider, external_id)
--       call_events(twilio_call_sid)
--       messages(twilio_message_sid)
--       opt_outs(clinic_id, phone_number)
--   - UUID primary keys via gen_random_uuid() (pgcrypto, enabled by default on
--     Supabase projects).
--   - All timestamps are timestamptz, default now().
--
-- This migration is NOT applied automatically. Apply it manually via the
-- Supabase CLI or SQL editor after explicit owner approval.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger function (shared)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clinics
--   One row per dental clinic tenant. Holds clinic-level identity and the
--   default settings used by the recovery workflow.
-- ---------------------------------------------------------------------------

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Optional slug used in internal URLs and logs. Unique when set.
  slug text unique,
  -- IANA timezone such as 'America/Chicago'. Used by future scheduling.
  timezone text not null default 'America/Chicago',
  -- Soft-disable flag. When false, no outbound SMS will be sent.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- clinic_phone_numbers
--   Maps the Twilio numbers a clinic uses for incoming voice / SMS to the
--   clinic. The recovery webhook handler looks up by the `To` E.164 number.
-- ---------------------------------------------------------------------------

create table if not exists public.clinic_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- E.164, e.g. +12245329236
  phone_number text not null,
  -- Twilio Phone Number SID (PN...). Optional during early provisioning.
  twilio_phone_number_sid text,
  -- Role hint: 'recovery' (outbound SMS source), 'main' (clinic main line), etc.
  role text not null default 'recovery',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A given phone number belongs to exactly one clinic.
create unique index if not exists clinic_phone_numbers_phone_number_key
  on public.clinic_phone_numbers (phone_number);

create index if not exists clinic_phone_numbers_clinic_id_idx
  on public.clinic_phone_numbers (clinic_id);

create trigger clinic_phone_numbers_set_updated_at
  before update on public.clinic_phone_numbers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- webhook_events
--   Raw, idempotent ingress log for Twilio + Stripe webhooks. Other tables
--   are derived from this. (provider, external_id) is the idempotency key.
-- ---------------------------------------------------------------------------

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('twilio', 'stripe')),
  event_type text not null,
  -- For Twilio voice: 'voice:<CallSid>'
  -- For Twilio SMS:   'sms:<MessageSid>'
  -- For Twilio status: 'sms_status:<MessageSid>:<status>'
  -- For Stripe:       Stripe event.id (evt_...)
  external_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create unique index if not exists webhook_events_provider_external_id_key
  on public.webhook_events (provider, external_id);

create index if not exists webhook_events_received_at_idx
  on public.webhook_events (received_at desc);

create index if not exists webhook_events_provider_event_type_idx
  on public.webhook_events (provider, event_type);

-- ---------------------------------------------------------------------------
-- call_events
--   Derived view of voice webhooks: one row per Twilio CallSid. Used by the
--   missed-call detector and the front desk inbox.
-- ---------------------------------------------------------------------------

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  twilio_call_sid text not null,
  -- E.164 caller and dialed numbers.
  from_number text,
  to_number text,
  call_status text,
  direction text,
  -- Whether this call is judged "missed" by the recovery rules. Populated by
  -- the detector in a later milestone; null here means "not yet classified".
  is_missed boolean,
  raw_payload jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_events_twilio_call_sid_key
  on public.call_events (twilio_call_sid);

create index if not exists call_events_clinic_id_occurred_at_idx
  on public.call_events (clinic_id, occurred_at desc);

create index if not exists call_events_from_number_idx
  on public.call_events (from_number);

create trigger call_events_set_updated_at
  before update on public.call_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- patient_conversations
--   One conversation thread per (clinic, patient phone) pair. The recovery
--   flow attaches inbound + outbound messages to a conversation.
-- ---------------------------------------------------------------------------

create table if not exists public.patient_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- Patient phone number in E.164. Names are intentionally not stored at
  -- this stage. If a future milestone needs them, add a `patient_name`
  -- column then with explicit owner approval.
  patient_phone text not null,
  status text not null default 'open'
    check (status in ('open', 'closed', 'booked', 'lost')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists patient_conversations_clinic_phone_key
  on public.patient_conversations (clinic_id, patient_phone);

create index if not exists patient_conversations_status_idx
  on public.patient_conversations (clinic_id, status, last_message_at desc);

create trigger patient_conversations_set_updated_at
  before update on public.patient_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages
--   Every inbound and outbound SMS. The Twilio MessageSid is the idempotency
--   key. The `body` column stores SMS text for inbound and outbound; this is
--   not PHI by design — see SMS rules in Skills/twilio-dental-sms.md.
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.patient_conversations(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  -- Twilio Message SID (SM... / MM...). Required.
  twilio_message_sid text not null,
  from_number text not null,
  to_number text not null,
  body text,
  -- Twilio status: queued / sending / sent / delivered / undelivered / failed / received.
  status text,
  error_code text,
  error_message text,
  -- Detected compliance keyword on inbound: stop / start / help / null.
  detected_keyword text check (detected_keyword in ('stop', 'start', 'help')),
  raw_payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists messages_twilio_message_sid_key
  on public.messages (twilio_message_sid);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists messages_clinic_id_created_at_idx
  on public.messages (clinic_id, created_at desc);

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- opt_outs
--   STOP/unsubscribe registry per (clinic, phone). The outbound sender must
--   refuse to send to any (clinic_id, phone_number) present here.
-- ---------------------------------------------------------------------------

create table if not exists public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  phone_number text not null,
  source text not null default 'sms_stop',
  opted_out_at timestamptz not null default now(),
  -- When set, the patient sent START and we are allowed to message again
  -- from this point onward.
  opted_back_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists opt_outs_clinic_phone_key
  on public.opt_outs (clinic_id, phone_number);

create trigger opt_outs_set_updated_at
  before update on public.opt_outs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--   Enabled on all multi-tenant tables. Policies will be defined in a follow-
--   up migration once we wire Supabase auth roles into the app.
-- ---------------------------------------------------------------------------

alter table public.clinics                enable row level security;
alter table public.clinic_phone_numbers   enable row level security;
alter table public.call_events            enable row level security;
alter table public.patient_conversations  enable row level security;
alter table public.messages               enable row level security;
alter table public.opt_outs               enable row level security;
alter table public.webhook_events         enable row level security;
