-- ============================================================
-- Requested vs Disbursed amount + manual disbursement date/amount entry
-- ============================================================

alter table leads add column if not exists disbursed_amount numeric(14,2);

-- Preview helper (used outside the trigger, e.g. if the UI wants to show
-- expected D before disbursing) — now prefers disbursed_amount when present.
create or replace function calculate_lead_payout(p_lead_id uuid)
returns numeric as $$
declare
    v_bank_id uuid;
    v_loan_type_id uuid;
    v_loan_amount numeric;
    v_disbursed_amount numeric;
    v_client_charge numeric;
    v_payout_type text;
    v_payout_value numeric;
    v_bank_payout numeric;
    v_effective_amount numeric;
begin
    select bank_id, loan_type_id, loan_amount, disbursed_amount, client_charge
    into v_bank_id, v_loan_type_id, v_loan_amount, v_disbursed_amount, v_client_charge
    from leads where id = p_lead_id;

    v_effective_amount := coalesce(v_disbursed_amount, v_loan_amount);

    select payout_type, payout_value
    into v_payout_type, v_payout_value
    from payout_matrix
    where bank_id = v_bank_id and loan_type_id = v_loan_type_id and active = true;

    if v_payout_type = 'percent_of_loan' then
        v_bank_payout := (v_payout_value / 100.0) * coalesce(v_effective_amount, 0);
    else
        v_bank_payout := v_payout_value;
    end if;

    return coalesce(v_bank_payout, 0) + coalesce(v_client_charge, 0);
end;
$$ language plpgsql;


-- Commission trigger: rewritten to read amounts directly from NEW (the row
-- being written in this same UPDATE) instead of re-querying the table --
-- because this is a BEFORE UPDATE trigger, a fresh SELECT would still see
-- the OLD disbursed_amount (NULL) rather than the value being set right now.
-- Also now respects a manually-supplied NEW.disbursed_at instead of always
-- overwriting it with now().
create or replace function process_commission_on_disbursement()
returns trigger as $$
declare
    v_bank_payout numeric;
    v_payout_type text;
    v_payout_value numeric;
    v_effective_amount numeric;
    v_D numeric;
    v_chain uuid[];
    v_chain_len int;
    v_remaining numeric;
    v_commission numeric;
    v_gen_commission numeric;
    v_handler_share numeric;
    i int;
begin
    if NEW.status <> 'Disbursed' or (OLD.status is not distinct from NEW.status) then
        return NEW;
    end if;

    v_effective_amount := coalesce(NEW.disbursed_amount, NEW.loan_amount);

    select payout_type, payout_value
    into v_payout_type, v_payout_value
    from payout_matrix
    where bank_id = NEW.bank_id and loan_type_id = NEW.loan_type_id and active = true;

    if v_payout_type = 'percent_of_loan' then
        v_bank_payout := (v_payout_value / 100.0) * coalesce(v_effective_amount, 0);
    else
        v_bank_payout := v_payout_value;
    end if;

    v_D := coalesce(v_bank_payout, 0) + coalesce(NEW.client_charge, 0);

    with recursive upline as (
        select id, parent_agent_id, 1 as depth
        from agents where id = NEW.generator_agent_id
        union all
        select a.id, a.parent_agent_id, u.depth + 1
        from agents a
        join upline u on a.id = u.parent_agent_id
    )
    select array_agg(id order by depth) into v_chain from upline;

    v_chain_len := array_length(v_chain, 1);

    v_gen_commission := round(0.6 * v_D, 2);
    v_remaining := v_D - v_gen_commission;

    if NEW.case_handled_by is not null and NEW.case_handled_by <> NEW.generator_agent_id then
        v_handler_share := round(0.2 * v_gen_commission, 2);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NEW.generator_agent_id, 1, 'generator', v_gen_commission - v_handler_share);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NEW.case_handled_by, 1, 'handler', v_handler_share);
    elsif NEW.case_handled_by is null then
        v_handler_share := round(0.2 * v_gen_commission, 2);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NEW.generator_agent_id, 1, 'generator', v_gen_commission - v_handler_share);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NULL, 1, 'company', v_handler_share);
    else
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NEW.generator_agent_id, 1, 'generator', v_gen_commission);
    end if;

    if v_chain_len > 1 then
        for i in 2..v_chain_len loop
            if i = v_chain_len then
                v_commission := round(v_remaining, 2);
            else
                v_commission := round(0.6 * v_remaining, 2);
            end if;

            insert into commission_ledger (lead_id, agent_id, level, role, amount)
            values (NEW.id, v_chain[i], i, 'senior', v_commission);

            v_remaining := v_remaining - v_commission;
        end loop;
    else
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (NEW.id, NULL, 2, 'company', round(v_remaining, 2));
    end if;

    NEW.disbursed_at := coalesce(NEW.disbursed_at, now());
    return NEW;
end;
$$ language plpgsql;
