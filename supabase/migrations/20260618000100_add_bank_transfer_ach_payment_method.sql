-- Add "Bank transfer / ACH" as a fixed AI Knowledge payment method.
--
-- One new boolean column on the per-clinic payment row, matching the other
-- fixed payment-method columns (cash, credit_debit_cards, personal_checks,
-- hsa_fsa_cards). Payment methods stay a fixed list — no custom additions and
-- no peer-to-peer apps (Zelle/Venmo/Cash App). No backfill needed; null means
-- "not answered yet". Legacy payment columns are intentionally left in place.

alter table public.clinic_ai_payment_settings
  add column if not exists bank_transfer_ach boolean;
