-- ============================================================
-- Invoice workflow: commission moves pending -> due -> paid
--   pending = calculated (lead disbursed) but agent hasn't invoiced yet
--   due     = agent raised an invoice, awaiting admin payment
--   paid    = admin marked it paid
-- ============================================================

alter table commission_ledger drop constraint if exists commission_ledger_payout_status_check;
alter table commission_ledger add constraint commission_ledger_payout_status_check
  check (payout_status in ('pending','due','paid'));

alter table commission_ledger add column if not exists invoiced_at timestamptz;
alter table commission_ledger add column if not exists paid_at timestamptz;
