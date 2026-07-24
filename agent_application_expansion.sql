-- ============================================================
-- Agent application form expansion: KYC fields + document uploads
-- (PAN, Aadhar, Photo, Cancelled Cheque compulsory; 2 optional slots)
-- ============================================================

alter table agent_applications
  add column if not exists father_name text,
  add column if not exists present_address text,
  add column if not exists permanent_address text,
  add column if not exists pan_number text,
  add column if not exists aadhar_number text,
  add column if not exists qualification text,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_code text;

-- Documents uploaded during the application itself (before an agent_id exists).
-- On approval these get copied into agent_documents against the new agent.
create table application_documents (
    id             uuid primary key default gen_random_uuid(),
    application_id uuid not null references agent_applications(id),
    label          text not null,   -- 'PAN','Aadhar','Photo','Cancelled Cheque','Optional 1','Optional 2'
    file_path      text not null,
    uploaded_at    timestamptz not null default now()
);

grant insert, select on application_documents to anon;

insert into document_types (name)
select 'Cancelled Cheque'
where not exists (select 1 from document_types where name = 'Cancelled Cheque');

-- Refresh the public listing view to include the new columns
create or replace view agent_applications_list as
  select id, name, phone, email, referral_code_entered, parent_agent_id, desired_username,
         father_name, present_address, permanent_address, pan_number, aadhar_number, qualification,
         bank_name, account_number, ifsc_code,
         status, rejection_reason, created_agent_id, reviewed_at, submitted_at
  from agent_applications;

-- ---------- Replace submit_agent_application with the expanded field set ----------
drop function if exists submit_agent_application(text, text, text, text, text, text);

create or replace function submit_agent_application(
    p_name text, p_phone text, p_email text,
    p_referral_code_entered text, p_desired_username text, p_password text,
    p_father_name text default null,
    p_present_address text default null,
    p_permanent_address text default null,
    p_pan_number text default null,
    p_aadhar_number text default null,
    p_qualification text default null,
    p_bank_name text default null,
    p_account_number text default null,
    p_ifsc_code text default null
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

    insert into agent_applications (
        name, phone, email, referral_code_entered, parent_agent_id, desired_username, password_hash,
        father_name, present_address, permanent_address, pan_number, aadhar_number, qualification,
        bank_name, account_number, ifsc_code
    )
    values (
        p_name, p_phone, p_email, p_referral_code_entered, v_parent_id, p_desired_username, crypt(p_password, gen_salt('bf')),
        p_father_name, p_present_address, p_permanent_address, p_pan_number, p_aadhar_number, p_qualification,
        p_bank_name, p_account_number, p_ifsc_code
    )
    returning id into v_app_id;

    return v_app_id;
end;
$$;

grant execute on function submit_agent_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;

-- ---------- Replace approve_agent_application to also migrate documents ----------
create or replace function approve_agent_application(p_application_id uuid, p_referral_code text)
returns uuid
language plpgsql
security definer
as $$
declare
    v_app agent_applications%rowtype;
    v_agent_id uuid;
    v_doc record;
    v_doc_type_id uuid;
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

    for v_doc in select * from application_documents where application_id = p_application_id loop
        select id into v_doc_type_id from document_types where name = v_doc.label;
        if v_doc_type_id is null then
            select id into v_doc_type_id from document_types where name = 'Other';
        end if;
        insert into agent_documents (agent_id, document_type_id, file_path, uploaded_by_agent_id)
        values (v_agent_id, v_doc_type_id, v_doc.file_path, v_agent_id);
    end loop;

    update agent_applications
    set status = 'Approved', reviewed_at = now(), created_agent_id = v_agent_id
    where id = p_application_id;

    return v_agent_id;
end;
$$;
