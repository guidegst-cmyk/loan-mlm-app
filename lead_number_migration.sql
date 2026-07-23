-- ============================================================
-- Adds a human-readable, sequential Lead Number + backfills it
-- for existing leads. Also nothing needed for disbursed_at —
-- that's already set automatically by the commission trigger
-- (process_commission_on_disbursement) whenever status -> Disbursed.
-- ============================================================

alter table leads add column if not exists lead_number serial;
