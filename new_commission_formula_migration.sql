-- ============================================================
-- NEW COMMISSION FORMULA: Company flat 30% of D, remaining 70%
-- (pool P) cascades using "topmost absorbs remainder" uniformly
-- at every level including the generator. Referral tree capped
-- at 5 generations structurally (enforced at agent creation).
-- ============================================================

create or replace function recompute_commission_for_lead(p_lead_id uuid)
returns void as $$
declare
    v_row leads%rowtype;
    v_effective_amount numeric;
    v_payout_type text;
    v_payout_value numeric;
    v_bank_payout numeric;
    v_D numeric;
    v_company_amount numeric;
    v_pool numeric;
    v_chain uuid[];
    v_chain_len int;
    v_remaining numeric;
    v_commission numeric;
    v_l1_commission numeric;
    v_handler_share numeric;
    i int;
begin
    select * into v_row from leads where id = p_lead_id;
    if v_row.status <> 'Disbursed' then
        return;
    end if;

    delete from commission_ledger where lead_id = p_lead_id;

    v_effective_amount := coalesce(v_row.disbursed_amount, v_row.loan_amount);

    select payout_type, payout_value into v_payout_type, v_payout_value
    from payout_matrix
    where bank_id = v_row.bank_id and loan_type_id = v_row.loan_type_id and active = true;

    if v_payout_type = 'percent_of_loan' then
        v_bank_payout := (v_payout_value / 100.0) * coalesce(v_effective_amount, 0);
    else
        v_bank_payout := v_payout_value;
    end if;

    v_D := coalesce(v_bank_payout, 0) + coalesce(v_row.client_charge, 0);

    -- Company always gets a flat 30% of D
    v_company_amount := round(0.30 * v_D, 2);
    v_pool := v_D - v_company_amount; -- ensures exact 100% sum regardless of rounding

    insert into commission_ledger (lead_id, agent_id, level, role, amount)
    values (p_lead_id, NULL, 0, 'company', v_company_amount);

    with recursive upline as (
        select id, parent_agent_id, 1 as depth
        from agents where id = v_row.generator_agent_id
        union all
        select a.id, a.parent_agent_id, u.depth + 1
        from agents a
        join upline u on a.id = u.parent_agent_id
    )
    select array_agg(id order by depth) into v_chain from upline;

    v_chain_len := array_length(v_chain, 1);
    v_remaining := v_pool;

    -- Cascade the 70% pool: "topmost absorbs remainder" applies uniformly at
    -- every level, including the generator (level 1) when they have no seniors.
    for i in 1..v_chain_len loop
        if i = v_chain_len then
            v_commission := round(v_remaining, 2);
        else
            v_commission := round(0.6 * v_remaining, 2);
        end if;

        if i = 1 then
            v_l1_commission := v_commission;

            -- lead-generator / case-handler 20% split applies only to the L1 share
            if v_row.case_handled_by is not null and v_row.case_handled_by <> v_row.generator_agent_id then
                v_handler_share := round(0.2 * v_l1_commission, 2);
                insert into commission_ledger (lead_id, agent_id, level, role, amount)
                values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission - v_handler_share);
                insert into commission_ledger (lead_id, agent_id, level, role, amount)
                values (p_lead_id, v_row.case_handled_by, 1, 'handler', v_handler_share);
            elsif v_row.case_handled_by is null then
                v_handler_share := round(0.2 * v_l1_commission, 2);
                insert into commission_ledger (lead_id, agent_id, level, role, amount)
                values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission - v_handler_share);
                insert into commission_ledger (lead_id, agent_id, level, role, amount)
                values (p_lead_id, NULL, 1, 'company', v_handler_share);
            else
                insert into commission_ledger (lead_id, agent_id, level, role, amount)
                values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission);
            end if;
        else
            insert into commission_ledger (lead_id, agent_id, level, role, amount)
            values (p_lead_id, v_chain[i], i, 'senior', v_commission);
        end if;

        v_remaining := v_remaining - v_commission;
    end loop;
end;
$$ language plpgsql;

-- Re-run for every already-disbursed lead so existing data reflects the new formula
do $$
declare r record;
begin
    for r in select id from leads where status = 'Disbursed' loop
        perform recompute_commission_for_lead(r.id);
    end loop;
end $$;

-- ============================================================
-- 5-generation structural cap
-- ============================================================

create or replace function agent_depth(p_agent_id uuid)
returns int as $$
declare
    v_depth int := 0;
    v_current uuid := p_agent_id;
begin
    while v_current is not null loop
        v_depth := v_depth + 1;
        select parent_agent_id into v_current from agents where id = v_current;
    end loop;
    return v_depth;
end;
$$ language plpgsql;

-- Enforce at self-onboarding approval time
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

    if v_app.parent_agent_id is not null and agent_depth(v_app.parent_agent_id) >= 5 then
        raise exception 'Cannot approve: this referral chain would exceed the 5-generation limit';
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

-- Enforce at application submission time too (early feedback)
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
        if agent_depth(v_parent_id) >= 5 then
            raise exception 'This referral code is already at the maximum 5-generation depth and cannot bring in further agents';
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
