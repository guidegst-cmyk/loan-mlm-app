-- ============================================================
-- AGENT SELF-ONBOARDING WORKFLOW
-- Public application (referral code or invite link) -> admin
-- review -> approve (creates real agent + login) or reject.
-- ============================================================

create table agent_applications (
    id                     uuid primary key default gen_random_uuid(),
    name                   text not null,
    phone                  text,
    email                  text,
    referral_code_entered  text,                          -- what the applicant typed, or came via invite link
    parent_agent_id        uuid references agents(id),    -- resolved from referral_code_entered
    desired_username       text,
    password_hash          text not null,                 -- applicant sets their own password
    status                 text not null default 'Pending'
                               check (status in ('Pending','Approved','Rejected')),
    rejection_reason       text,
    created_agent_id       uuid references agents(id),    -- set once approved
    reviewed_at            timestamptz,
    submitted_at           timestamptz not null default now()
);

-- Public listing view WITHOUT the password hash, for the admin panel
create or replace view agent_applications_list as
  select id, name, phone, email, referral_code_entered, parent_agent_id, desired_username,
         status, rejection_reason, created_agent_id, reviewed_at, submitted_at
  from agent_applications;

-- Lock down the raw table (holds password hashes); only the RPCs below touch it
revoke all on agent_applications from anon;
grant select on agent_applications_list to anon;

-- ---------- Submit an application (public, no login needed) ----------
create or replace function submit_agent_application(
    p_name text, p_phone text, p_email text,
    p_referral_code_entered text, p_desired_username text, p_password text
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_parent_id uuid;
    v_app_id uuid;
begin
    if p_referral_code_entered is not null and trim(p_referral_code_entered) <> '' then
        select id into v_parent_id from agents where lower(referral_code) = lower(trim(p_referral_code_entered));
        if v_parent_id is null then
            raise exception 'Referral code not found';
        end if;
    end if;

    insert into agent_applications (name, phone, email, referral_code_entered, parent_agent_id, desired_username, password_hash)
    values (p_name, p_phone, p_email, p_referral_code_entered, v_parent_id, p_desired_username, crypt(p_password, gen_salt('bf')))
    returning id into v_app_id;

    return v_app_id;
end;
$$;

grant execute on function submit_agent_application(text, text, text, text, text, text) to anon;

-- ---------- Approve (admin) — creates the real agent + login ----------
create or replace function approve_agent_application(p_application_id uuid, p_referral_code text)
returns uuid
language plpgsql
security definer
as $$
declare
    v_app agent_applications%rowtype;
    v_agent_id uuid;
begin
    select * into v_app from agent_applications where id = p_application_id and status = 'Pending';
    if not found then
        raise exception 'Application not found or already reviewed';
    end if;

    insert into agents (name, parent_agent_id, referral_code, status)
    values (v_app.name, v_app.parent_agent_id, p_referral_code, 'active')
    returning id into v_agent_id;

    insert into app_users (username, password_hash, role, agent_id)
    values (lower(coalesce(nullif(v_app.desired_username, ''), p_referral_code)), v_app.password_hash, 'agent', v_agent_id);

    update agent_applications
    set status = 'Approved', reviewed_at = now(), created_agent_id = v_agent_id
    where id = p_application_id;

    return v_agent_id;
end;
$$;

grant execute on function approve_agent_application(uuid, text) to anon;

-- ---------- Reject (admin) ----------
create or replace function reject_agent_application(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
begin
    update agent_applications
    set status = 'Rejected', rejection_reason = p_reason, reviewed_at = now()
    where id = p_application_id and status = 'Pending';
end;
$$;

grant execute on function reject_agent_application(uuid, text) to anon;
