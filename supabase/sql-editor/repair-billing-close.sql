-- ZH-BIL-01 repair: reserve accruals written by the old billing close counted reserve-fund-funded
-- expenses as profit-reducing costs. Aligns four closed periods with the shared accrual formula
-- (see scripts/reconcile-reserve-accruals.mjs). Run as postgres. Ends with ROLLBACK by default;
-- change the last statement to COMMIT only after reviewing the NOTICE and result output.
-- Each row is guarded by its previous amount, so a changed row aborts the whole script.
begin;

do $$
declare
  fix record;
  v_before public.reserve_fund_transactions%rowtype;
  v_after public.reserve_fund_transactions%rowtype;
  v_period public.billing_periods%rowtype;
begin
  for fix in
    select * from (values
      ('fbe47f66-1345-4fbe-81a7-42c12e2ca727'::uuid, 2125619::numeric, 2491619::numeric),
      ('e1f0004a-af64-45c5-9388-4b140e549908'::uuid, 1970370::numeric, 2489834::numeric),
      ('771e827b-f876-4329-938c-40b2043d1986'::uuid, 2129899::numeric, 2334899::numeric),
      ('7d895ea5-6f51-4f3d-8c03-6bd3117fff2f'::uuid, 2764251::numeric, 2971851::numeric)
    ) as t(billing_period_id, old_amount, new_amount)
  loop
    select * into v_period from public.billing_periods where id = fix.billing_period_id;
    if not found then
      raise exception 'Billing period % not found', fix.billing_period_id;
    end if;

    select tx.* into v_before
    from public.reserve_fund_transactions tx
    join public.reserve_funds fund on fund.id = tx.fund_id
    where fund.building_id = v_period.building_id
      and tx.source = 'monthly_accrual'
      and tx.period_year = v_period.period_year
      and tx.period_month = v_period.period_month
      and tx.voided_at is null
    for update of tx;
    if not found or v_before.amount <> fix.old_amount then
      raise exception 'Accrual for period % is missing or no longer %, aborting', fix.billing_period_id, fix.old_amount;
    end if;

    update public.reserve_fund_transactions
    set amount = fix.new_amount
    where id = v_before.id
    returning * into v_after;

    insert into public.billing_audit_events (
      billing_period_id, building_id, period_year, period_month, action,
      entity_type, entity_id, before_data, after_data, metadata
    ) values (
      v_period.id, v_period.building_id, v_period.period_year, v_period.period_month,
      'reserve_accrual.repaired', 'billing_period', v_period.id,
      jsonb_build_object('amount', v_before.amount),
      jsonb_build_object('amount', v_after.amount),
      jsonb_build_object(
        'reason', 'ZH-BIL-01 reconciliation: exclude reserve-fund-funded expenses from accrual profit',
        'transaction_id', v_before.id,
        'difference', fix.new_amount - fix.old_amount
      )
    );

    raise notice 'period % (%-%): % -> % (+%)', v_period.id, v_period.period_year, v_period.period_month,
      fix.old_amount, fix.new_amount, fix.new_amount - fix.old_amount;
  end loop;
end $$;

select bp.period_year, bp.period_month, tx.amount, tx.reserve_rate_percent, tx.issued_revenue
from public.reserve_fund_transactions tx
join public.billing_periods bp on bp.id = tx.billing_period_id
where tx.source = 'monthly_accrual'
  and bp.id in (
    'fbe47f66-1345-4fbe-81a7-42c12e2ca727', 'e1f0004a-af64-45c5-9388-4b140e549908',
    '771e827b-f876-4329-938c-40b2043d1986', '7d895ea5-6f51-4f3d-8c03-6bd3117fff2f'
  )
order by bp.period_year, bp.period_month;

rollback;
