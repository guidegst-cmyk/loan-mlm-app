-- ============================================================
-- SIX CHANGES:
--  1. Multi-bank submission (up to 3) -> final bank at disbursement
--  2. Co-applicant details
--  3. Security & Insurance details (post-disbursement)
--  4. TDS on commission
--  5. Applicant PAN/Aadhar/Address + PAN-based duplicate detection
--  6. Rejection reason
-- ============================================================

-- ---------- 1. Multi-bank submission ----------
-- bank_id becomes the FINAL bank (set at Disbursed); nullable until then.
alter table leads alter column bank_id drop not null;
alter table leads add column if not exists submitted_bank_ids uuid[];

-- ---------- 2. Co-applicant details ----------
alter table leads add column if not exists has_co_applicant boolean not null default false;
alter table leads add column if not exists co_applicant_name text;
alter table leads add column if not exists co_applicant_pan text;
alter table leads add column if not exists co_applicant_aadhar text;
alter table leads add column if not exists co_applicant_address text;

-- ---------- 5. Applicant PAN/Aadhar/Address ----------
alter table leads add column if not exists customer_pan text;
alter table leads add column if not exists customer_aadhar text;
alter table leads add column if not exists customer_address text;

-- ---------- 3. Security & Insurance (post-disbursement) ----------
alter table leads add column if not exists security_details text;
alter table leads add column if not exists insurance_insurer text;
alter table leads add column if not exists insurance_policy_number text;
alter table leads add column if not exists insurance_cover_amount numeric(14,2);
alter table leads add column if not exists insurance_vehicle_make_model text;

-- ---------- 6. Rejection reason ----------
alter table leads add column if not exists rejection_reason text;

-- ---------- 4. TDS on commission ----------
alter table commission_ledger add column if not exists tds_amount numeric(12,2) not null default 0;
