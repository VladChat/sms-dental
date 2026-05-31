-- Owner authentication foundation — profiles + clinic memberships.
--
-- Adds:
--   - public.profiles
--   - public.clinic_memberships
--
-- Purpose:
--   Phase 1 real auth foundation for owner login/password while preserving the
--   existing setup-token onboarding entry path.
--
-- This migration is NOT applied automatically. Apply via Supabase SQL editor
-- or admin DB connection after explicit owner approval.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_internal_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'front_desk'
    check (role in ('owner', 'front_desk', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, profile_id)
);

create index if not exists clinic_memberships_profile_idx
  on public.clinic_memberships (profile_id, status);

create index if not exists clinic_memberships_clinic_idx
  on public.clinic_memberships (clinic_id, status);

create trigger clinic_memberships_set_updated_at
  before update on public.clinic_memberships
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.clinic_memberships enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_select'
  ) then
    create policy profiles_self_select
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_insert'
  ) then
    create policy profiles_self_insert
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_update'
  ) then
    create policy profiles_self_update
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clinic_memberships'
      and policyname = 'clinic_memberships_self_select'
  ) then
    create policy clinic_memberships_self_select
      on public.clinic_memberships
      for select
      using (auth.uid() = profile_id);
  end if;
end $$;
