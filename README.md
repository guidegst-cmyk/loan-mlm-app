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

## Notifications (new)
- Run `notifications_migration.sql` before using this
- Admin: **Notifications** tab → compose a title/message, send to **Everyone**, **a specific team** (an
  agent + their full downline), or **one specific agent**
- Agent: sees only notifications actually targeted to them (all-broadcast, their team, or sent to them
  individually) under their own **Notifications** tab

## Notifications: unread badge + live updates (new)
- Run `notifications_realtime_migration.sql` (enables Supabase Realtime on the notifications table +
  adds read tracking) after `notifications_migration.sql`
- Agent's Notifications tab now shows a red unread-count badge; opening the tab marks visible items as read
- New notifications appear live for anyone with the app open (no refresh needed) via Supabase Realtime

## Mobile responsiveness (new)
Added proper responsive breakpoints — tables scroll horizontally on narrow screens instead of overflowing,
tabs scroll horizontally, stat cards collapse from 4 → 2 → 1 columns, forms collapse from 2 → 1 columns,
and the login/apply screens no longer overflow on narrow phones (e.g. iPhone SE at 320px wide).
No SQL changes needed for this — frontend-only.

## Admin Dashboard rebuild (new)
No SQL changes needed — frontend only, computed from already-loaded data.
- **Money summary** cards (total leads, pending/due/paid) — the "Invoiced" card is clickable, jumps to Commissions
- **Status cards** for New/Verified/Submitted/Disbursed/Rejected — click a card to expand a loan-type
  breakdown inline (how many Home Loan, Personal Loan, etc. in that status), with a "View these leads"
  link that jumps to the Leads tab pre-filtered to that status
- **Team performance** table — one row per team (the direct reports of your topmost agent(s) + their full
  downline): total leads, disbursed, rejected, total commission generated
- **Top performers** — top 5 agents by total commission earned
- **Flagged agents** — agents with ≥34% rejection rate (min. 2 decided leads) or zero leads generated yet;
  rule is shown in the UI and can be tuned in `src/lib/dashboardAnalytics.js`

## Final client-handoff fixes
- Rebranded throughout: "Loan Lead Referral Platform" → **LoanNexus.in**
- Agents tab is now an org-chart style drill-down: click any agent's name to see their team open up below
  (connector lines, org-chart boxes). A "← Back" button appears to go back up one level. Agents can only
  ever drill into their own downline — they start locked at their own position and can't navigate above it.

## Agents tab fix
- Fixed: admin's org chart was defaulting to whichever root-level agent came first alphabetically
  (e.g. a self-onboarded agent with no referral code) instead of the real company root. Now, if there are
  multiple root-level agents, admin sees a virtual "🏢 Organization" node with all real roots as its
  children to drill into.
- The org chart now always shows the parent-of-focus (immediate senior) in a dashed box above the current
  node, in the same view — no extra click needed to see who someone reports to. For an agent's own default
  view, this is their real immediate senior; agents still can't navigate above their own position.

## Expanded agent application (new)
- Run `agent_application_expansion.sql` (after all previous onboarding migrations)
- Application is now a 2-step form:
  1. **Details** — Full name, Father's name, Phone, Email, Qualification, Present/Permanent address
     (with "same as present" checkbox), PAN number, Aadhar number, Bank name/Account number/IFSC, plus the
     existing referral/username/password fields. All new fields are compulsory.
  2. **Documents** — PAN, Aadhar, Photo, Cancelled Cheque (all compulsory) + 2 optional document slots
- Documents are uploaded immediately during the application (before admin approval) to the `agent-documents`
  bucket, tracked in a new `application_documents` table
- On admin approval, uploaded documents automatically migrate into `agent_documents` against the newly
  created agent — they show up in Master Data → Agent Documents right away, no re-upload needed
- Admin's Applications review panel now has a "View full details & documents" toggle per pending
  application showing all KYC fields and document view-links before approving
