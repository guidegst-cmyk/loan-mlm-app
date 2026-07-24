# Loan Lead Referral Platform — Demo App

## Setup
1. `npm install`
2. `.env` already has your Supabase URL + anon key
3. `npm run dev` — opens at http://localhost:5173

## Before running (in Supabase SQL Editor, in this order)
1. `schema.sql` — tables, functions, triggers
2. `seed_data.sql` — dummy agents/banks/leads
3. `auth_setup.sql` — dummy login system
4. `master_data_setup.sql` — agent documents table + agent-creation login RPC
5. `lead_number_migration.sql` — adds a sequential Lead # column to leads (auto-backfills existing rows)
6. `disbursement_amount_migration.sql` — adds disbursed_amount, and fixes the commission trigger to use the manually-entered disbursed amount & date
7. Create a **private** Storage bucket named `loan-documents` (for lead/customer documents)
8. Create a **private** Storage bucket named `agent-documents` (for agent KYC/agreement documents)
9. Run `storage_policies.sql` (covers both buckets) for demo-grade upload/view permissions

## Demo logins
- **Admin:** `admin` / `Welcome@123`
- **Any agent:** referral code (lowercase), e.g. `rs-root`, `pv-001`, `rk-006`. Same password: `Welcome@123`

## What's in this app
- Login screen (dummy credentials)
- **Admin:** Dashboard, Agents tree, Leads (with status/date filters), Commission ledger (grouped per lead,
  filterable by date/agent/team-vs-individual, shows loan details + payout master rate), and **Master Data**:
  - Add new agents (auto-creates their login too)
  - Add banks, loan types
  - Add/edit payout matrix rates (rate changes only affect future disbursements — already-disbursed
    leads keep their frozen commission amounts)
  - Per-agent document upload: PAN, Aadhar, Photo, Agent Agreement, Other (agreement itself is drafted
    outside the app — this just stores/tracks it)
- **Agent:** "My Dashboard" (own leads vs team leads, own earnings), scoped Agents/Leads/Commissions tabs

## Security note
The dummy login system (`app_users` + `login_app_user()` RPC) is demo-grade — no sessions/tokens/expiry,
no RLS enforcement. Before a real client rollout, replace with Supabase Auth + Row Level Security tied to
auth.uid().

## This round of fixes
- **Agent privacy:** Agents tab now shows only the logged-in agent's own subtree (self + juniors) plus
  their immediate senior for context — never the full company hierarchy, not even dimmed.
- **Expected commission preview:** the New Lead form shows a live commission breakdown as you fill in
  bank/loan type/amount, using the same cascade formula as the real engine.
- **Invoice workflow:** commission now moves `pending` → `due` → `paid`.
  - Agent: once a lead is Disbursed, their own commission rows show "Raise invoice" (Commissions tab)
    to move them to `due`.
  - Admin: `due` rows show "Mark paid".
  - Run `invoice_workflow_migration.sql` before using this.
- **Agent Dashboard** now shows Expected (pipeline forecast) / Pending / Due / Paid / Total earned.

## Important caveat on agent data privacy
The Agents-tab restriction above is a **UI-level** filter — the demo login system has no real Row Level
Security, so the full agents list is still fetched into the browser for every logged-in user (just not
rendered for agents). Anyone comfortable opening browser dev tools could see the raw API response.
True data-level isolation requires replacing the dummy login with Supabase Auth + RLS policies scoped to
auth.uid() — recommended before a real production rollout, especially once real agent commission figures
are involved.

## Agent self-onboarding (new)
- Public application form at `<your-url>/?apply=true` (or share `<your-url>/?apply=true&ref=<referral_code>`
  to prefill who referred them — each agent's "My Dashboard" now shows their own shareable invite link)
- Applicant sets their own username/password; application sits as **Pending**
- Admin reviews under **Master Data → Applications**: assign a referral code and **Approve** (creates the
  real agent + activates their login), or **Reject** with a reason
- Run `agent_self_onboarding.sql` before using this
