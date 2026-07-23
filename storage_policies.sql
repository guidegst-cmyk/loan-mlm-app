-- ============================================================
-- STORAGE SETUP for document uploads
-- Run in Supabase SQL Editor after the bucket is created via
-- Dashboard -> Storage -> New bucket -> name: loan-documents -> Public: OFF
-- ============================================================

-- Demo-only policies: allow the anon key to read/write everything in this
-- bucket. Fine for a client demo with no real auth wired up yet.
-- Before a real rollout, replace these with auth.uid()-based policies once
-- Supabase Auth + an agent_id mapping is in place.

create policy "demo_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'loan-documents');

create policy "demo_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'loan-documents');

create policy "demo_anon_update" on storage.objects
  for update to anon
  using (bucket_id = 'loan-documents');

-- ============================================================
-- AGENT DOCUMENTS bucket (separate from loan-documents)
-- Create via Dashboard -> Storage -> New bucket -> name: agent-documents -> Public: OFF
-- Then run the policies below.
-- ============================================================

create policy "demo_anon_insert_agentdocs" on storage.objects
  for insert to anon
  with check (bucket_id = 'agent-documents');

create policy "demo_anon_select_agentdocs" on storage.objects
  for select to anon
  using (bucket_id = 'agent-documents');

create policy "demo_anon_update_agentdocs" on storage.objects
  for update to anon
  using (bucket_id = 'agent-documents');
