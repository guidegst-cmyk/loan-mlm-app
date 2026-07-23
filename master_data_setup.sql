-- ============================================================
-- MASTER DATA ADDITIONS: agent documents + agent-creation login RPC
-- Run after schema.sql, seed_data.sql, auth_setup.sql
-- ============================================================

-- ---------- AGENT DOCUMENTS (PAN, Aadhar, Photo, Agreement, Other) ----------
-- Reuses the same document_types master list as loan_documents.
create table agent_documents (
    id                  uuid primary key default gen_random_uuid(),
    agent_id            uuid not null references agents(id),
    document_type_id    uuid not null references document_types(id),
    file_path           text not null,          -- path in the "agent-documents" storage bucket
    version             int not null default 1,
    uploaded_by_agent_id uuid references agents(id),   -- null = uploaded by admin
    status              text not null default 'Uploaded'
                            check (status in ('Uploaded','Verified','Rejected')),
    verified_by         uuid references agents(id),
    verified_at         timestamptz,
    rejection_reason    text,
    uploaded_at         timestamptz not null default now()
);

create index idx_agent_docs_agent on agent_documents(agent_id);

-- Add an explicit "Agent Agreement" document type (PAN/Aadhar/Photo/Other already exist)
insert into document_types (name)
select 'Agent Agreement'
where not exists (select 1 from document_types where name = 'Agent Agreement');

-- ---------- Create-agent-with-login RPC ----------
-- The anon key can insert into `agents` directly (no RLS on that table),
-- but app_users is locked down (see auth_setup.sql), so creating a new
-- agent's login has to go through this function instead.
create or replace function create_agent_login(
    p_agent_id uuid,
    p_username text,
    p_password text default 'Welcome@123'
)
returns void
language plpgsql
security definer
as $$
begin
    insert into app_users (username, password_hash, role, agent_id)
    values (lower(p_username), crypt(p_password, gen_salt('bf')), 'agent', p_agent_id)
    on conflict (username) do nothing;
end;
$$;

grant execute on function create_agent_login(uuid, text, text) to anon;
