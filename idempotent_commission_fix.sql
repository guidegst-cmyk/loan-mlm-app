-- ============================================================
-- FIX: commission calculation was not idempotent — re-triggering
-- disbursement (e.g. correcting the disbursed amount) added a SECOND
-- set of commission rows on top of the first instead of replacing them.
--
-- This migration:
--   1. Extracts the calculation into a reusable, idempotent function
--      that clears any existing rows for a lead before recalculating.
--   2. Splits the old single BEFORE trigger into two: a BEFORE trigger
--      that only sets disbursed_at, and an AFTER trigger that calls the
--      idempotent recompute function (AFTER means it can safely re-read
--      the row from the table — no more stale-read risk either).
--   3. Cleans up EXISTING duplicate/stale commission rows by recomputing
--      commission fresh for every already-disbursed lead right now.
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
    v_chain uuid[];
    v_chain_len int;
    v_remaining numeric;
    v_commission numeric;
    v_gen_commission numeric;
    v_handler_share numeric;
    i int;
begin
    select * into v_row from leads where id = p_lead_id;
    if v_row.status <> 'Disbursed' then
        return;
    end if;

    -- idempotency: always clear this lead's existing commission rows first
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

    with recursive upline as (
        select id, parent_agent_id, 1 as depth from agents where id = v_row.generator_agent_id
        union all
        select a.id, a.parent_agent_id, u.depth + 1 from agents a join upline u on a.id = u.parent_agent_id
    )
    select array_agg(id order by depth) into v_chain from upline;
    v_chain_len := array_length(v_chain, 1);

    v_gen_commission := round(0.6 * v_D, 2);
    v_remaining := v_D - v_gen_commission;

    if v_row.case_handled_by is not null and v_row.case_handled_by <> v_row.generator_agent_id then
        v_handler_share := round(0.2 * v_gen_commission, 2);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_gen_commission - v_handler_share);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.case_handled_by, 1, 'handler', v_handler_share);
    elsif v_row.case_handled_by is null then
        v_handler_share := round(0.2 * v_gen_commission, 2);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_gen_commission - v_handler_share);
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, NULL, 1, 'company', v_handler_share);
    else
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, v_row.generator_agent_id, 1, 'generator', v_gen_commission);
    end if;

    if v_chain_len > 1 then
        for i in 2..v_chain_len loop
            if i = v_chain_len then
                v_commission := round(v_remaining, 2);
            else
                v_commission := round(0.6 * v_remaining, 2);
            end if;
            insert into commission_ledger (lead_id, agent_id, level, role, amount)
            values (p_lead_id, v_chain[i], i, 'senior', v_commission);
            v_remaining := v_remaining - v_commission;
        end loop;
    else
        insert into commission_ledger (lead_id, agent_id, level, role, amount)
        values (p_lead_id, NULL, 2, 'company', round(v_remaining, 2));
    end if;
end;
$$ language plpgsql;

-- Drop the old single trigger + function
drop trigger if exists trg_process_commission on leads;
drop function if exists process_commission_on_disbursement();

-- New BEFORE trigger: only sets disbursed_at (default to now() if not supplied)
create or replace function set_disbursed_at()
returns trigger as $$
begin
    if NEW.status = 'Disbursed' and (OLD.status is distinct from NEW.status) then
        NEW.disbursed_at := coalesce(NEW.disbursed_at, now());
    end if;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_set_disbursed_at on leads;
create trigger trg_set_disbursed_at
before update on leads
for each row
execute function set_disbursed_at();

-- New AFTER trigger: recomputes commission (idempotently) whenever a lead
-- becomes Disbursed, or its disbursed_amount is corrected afterwards
create or replace function trigger_recompute_commission()
returns trigger as $$
begin
    if NEW.status = 'Disbursed'
       and (OLD.status is distinct from NEW.status or OLD.disbursed_amount is distinct from NEW.disbursed_amount) then
        perform recompute_commission_for_lead(NEW.id);
    end if;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_recompute_commission on leads;
create trigger trg_recompute_commission
after update on leads
for each row
execute function trigger_recompute_commission();

-- ---------- ONE-OFF CLEANUP: fix existing duplicate/stale commission rows ----------
do $$
declare r record;
begin
    for r in select id from leads where status = 'Disbursed' loop
        perform recompute_commission_for_lead(r.id);
    end loop;
end $$;
