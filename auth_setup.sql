-- ============================================================
-- DUMMY LOGIN SYSTEM (lightweight, demo-grade)
-- Not Supabase Auth — a simple app_users table + a server-side
-- RPC that checks the password with pgcrypto. Good enough for a
-- client demo; swap for real Supabase Auth before production.
-- ============================================================

create extension if not exists pgcrypto;

create table app_users (
    id            uuid primary key default gen_random_uuid(),
    username      text not null unique,
    password_hash text not null,
    role          text not null check (role in ('admin','agent')),
    agent_id      uuid references agents(id),   -- null for admin
    created_at    timestamptz not null default now()
);

-- Login function: returns the matching user's role/agent info if the
-- password is correct, otherwise an empty result. Runs server-side so
-- the password hash is never sent to the browser.
create or replace function login_app_user(p_username text, p_password text)
returns table (username text, role text, agent_id uuid, agent_name text)
language plpgsql
security definer
as $$
begin
    return query
    select u.username, u.role, u.agent_id, a.name
    from app_users u
    left join agents a on a.id = u.agent_id
    where lower(u.username) = lower(p_username)
      and u.password_hash = crypt(p_password, u.password_hash);
end;
$$;

-- Allow the anon key to call the login function (but NOT read app_users directly)
grant execute on function login_app_user(text, text) to anon;
revoke all on app_users from anon;

-- ---------- Seed dummy users: admin + one per agent, same default password ----------
insert into app_users (username, password_hash, role, agent_id)
select 'admin', crypt('Welcome@123', gen_salt('bf')), 'admin', null;

insert into app_users (username, password_hash, role, agent_id)
select lower(a.referral_code), crypt('Welcome@123', gen_salt('bf')), 'agent', a.id
from agents a;
