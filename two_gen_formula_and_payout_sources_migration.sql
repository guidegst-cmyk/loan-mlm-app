-- ============================================================
-- 1. NEW 2-GENERATION COMMISSION FORMULA
--    Company flat 30% of D. Remaining 70% (pool) splits:
--    Generator 80% of pool (=56% of D), Immediate senior 20%
--    of pool (=14% of D). Anyone above the immediate senior
--    earns nothing from this lead. If generator has no senior,
--    generator absorbs the full pool (100%, = 70% of D).
-- 2. PAYOUT MATRIX: 3 sources per bank+loan-type (DSA-1, DSA-2,
--    Direct) instead of one. Leads now record which source the
--    final disbursed deal actually went through.
-- ============================================================

-- ---------- Payout matrix: add source dimension ----------
alter table payout_matrix drop constraint if exists payout_matrix_bank_id_loan_type_id_key;
alter table payout_matrix add column if not exists source text not null default 'Direct'
  check (source in ('DSA-1', 'DSA-2', 'Direct'));
alter table payout_matrix add constraint payout_matrix_bank_loan_source_key
  unique (bank_id, loan_type_id, source);

-- ---------- Leads: record which source the final deal went through ----------
alter table leads add column if not exists payout_source text
  check (payout_source in ('DSA-1', 'DSA-2', 'Direct'));

-- ---------- New commission function ----------
create or replace function recompute_commission_for_lead(p_lead_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
    v_row public.leads%rowtype;
    v_effective_amount numeric;
    v_payout_type text;
    v_payout_value numeric;
    v_bank_payout numeric;
    v_D numeric;
    v_company_amount numeric;
    v_pool numeric;
    v_chain uuid[];
    v_chain_len int;
    v_generator_amount numeric;
    v_senior_amount numeric;
    v_l1_commission numeric;
    v_handler_share numeric;
begin
    select * into v_row from public.leads where id = p_lead_id;
    if v_row.status <> 'Disbursed' then
        return;
    end if;

    delete from public.commission_ledger where lead_id = p_lead_id;

    v_effective_amount := coalesce(v_row.disbursed_amount, v_row.loan_amount);

    select payout_type, payout_value into v_payout_type, v_payout_value
    from public.payout_matrix
    where bank_id = v_row.bank_id
      and loan_type_id = v_row.loan_type_id
      and source = coalesce(v_row.payout_source, 'Direct')
      and active = true;

    if v_payout_type = 'percent_of_loan' then
        v_bank_payout := (v_payout_value / 100.0) * coalesce(v_effective_amount, 0);
    else
        v_bank_payout := v_payout_value;
    end if;

    v_D := coalesce(v_bank_payout, 0) + coalesce(v_row.client_charge, 0);

    v_company_amount := round(0.30 * v_D, 2);
    v_pool := v_D - v_company_amount;

    insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
    values (p_lead_id, NULL, 0, 'company', v_company_amount);

    with recursive upline as (
        select id, parent_agent_id, 1 as depth
        from public.agents where id = v_row.generator_agent_id
        union all
        select a.id, a.parent_agent_id, u.depth + 1
        from public.agents a
        join upline u on a.id = u.parent_agent_id
    )
    select array_agg(id order by depth) into v_chain from upline;

    v_chain_len := array_length(v_chain, 1);

    if v_chain_len = 1 then
        v_l1_commission := round(v_pool, 2);
    else
        v_l1_commission := round(0.8 * v_pool, 2);
        v_senior_amount := v_pool - v_l1_commission;
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_chain[2], 2, 'senior', v_senior_amount);
    end if;

    if v_row.case_handled_by is not null and v_row.case_handled_by <> v_row.generator_agent_id then
        v_handler_share := round(0.2 * v_l1_commission, 2);
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission - v_handler_share);
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.case_handled_by, 1, 'handler', v_handler_share);
    elsif v_row.case_handled_by is null then
        v_handler_share := round(0.2 * v_l1_commission, 2);
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission - v_handler_share);
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, NULL, 1, 'company', v_handler_share);
    else
        insert into public.commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_l1_commission);
    end if;
end;
$$;

do $$
declare r record;
begin
    for r in select id from public.leads where status = 'Disbursed' loop
        perform recompute_commission_for_lead(r.id);
    end loop;
end $$;
