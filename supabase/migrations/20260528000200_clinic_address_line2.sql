-- Add an optional second address line to clinics for the Business Information
-- card (suite / unit / floor). Nullable and non-destructive.
--
-- This migration is idempotent and safe to re-run. Apply via Supabase SQL
-- editor or admin DB connection. Earlier migrations should be applied first.

alter table public.clinics
  add column if not exists address_line2 text;
