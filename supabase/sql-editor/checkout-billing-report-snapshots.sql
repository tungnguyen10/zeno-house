-- Apply in cloud SQL Editor AFTER 20261001143337_contract_checkout_settlement.sql.
-- Preserves full existing snapshots while distinguishing actual cash from source applications.
begin;

create or replace function public.billing_period_input_snapshot(p_period_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with period as (
    select bp.* from public.billing_periods bp where bp.id = p_period_id
  ), bounds as (
    select
      p.*,
      make_date(p.period_year, p.period_month, 1) as first_day,
      (make_date(p.period_year, p.period_month, 1) + interval '1 month - 1 day')::date as last_day,
      (make_date(p.period_year, p.period_month, 1) - interval '1 month')::date as previous_day
    from period p
  ), contracts as (
    select c.* from public.contracts c join bounds b on b.building_id = c.building_id
    where (c.status <> 'terminated' and c.start_date <= b.last_day
      and (c.end_date is null or c.end_date >= b.first_day)
      and not exists(select 1 from public.contract_checkouts h where h.contract_id=c.id and h.status='returned'))
      or exists(select 1 from public.contract_checkouts h where h.contract_id=c.id and h.status='returned'
        and h.financial_mode<>'legacy' and h.actual_return_date between b.first_day and b.last_day)
  ), room_ids as (select distinct room_id as id from contracts), contract_ids as (select id from contracts)
  select jsonb_build_object(
    'building', (select to_jsonb(bld) from public.buildings bld join bounds b on b.building_id = bld.id),
    'checkouts', coalesce((
      select jsonb_agg(to_jsonb(h) || jsonb_build_object('charges', public.contract_checkout_preview(h.contract_id)->'charges',
        'final_bill_issued', exists(select 1 from public.contract_checkout_final_bills fb where fb.checkout_id=h.id),
        'settlement_confirmed', exists(select 1 from public.contract_checkout_statements s where s.checkout_id=h.id)))
      from public.contract_checkouts h join bounds b on h.building_id=b.building_id
      where h.contract_id in (select id from contract_ids) and h.status='returned' and h.financial_mode<>'legacy'
        and h.actual_return_date between b.first_day and b.last_day
    ), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(to_jsonb(c)) from contracts c), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(cs) || jsonb_build_object('service_catalog', to_jsonb(sc)))
      from public.contract_services cs
      left join public.service_catalog sc on sc.id = cs.catalog_id
      where cs.contract_id in (select id from contract_ids) and cs.is_enabled = true
    ), '[]'::jsonb),
    'occupants', coalesce((
      select jsonb_agg(to_jsonb(co)) from public.contract_occupants co
      where co.contract_id in (select id from contract_ids)
    ), '[]'::jsonb),
    'readings', coalesce((
      select jsonb_agg(to_jsonb(mr)) from public.meter_readings mr join bounds b on true
      where mr.room_id in (select id from room_ids) and (
        (mr.reading_type = 'monthly' and (
          (mr.period_year = b.period_year and mr.period_month = b.period_month)
          or (mr.period_year = extract(year from b.previous_day)::integer
              and mr.period_month = extract(month from b.previous_day)::integer)
        )) or mr.reading_type = 'handover_in'
      )
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(u)) from public.billing_utility_usages u where u.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'incidental_charges', coalesce((
      select jsonb_agg(to_jsonb(ic) order by ic.created_at, ic.id)
      from public.billing_incidental_charges ic
      where ic.billing_period_id = p_period_id
        and ic.contract_id in (select id from contract_ids)
        and ic.deleted_at is null
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at) from public.invoices i where i.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.room_number) from public.rooms r join bounds b on b.building_id = r.building_id
    ), '[]'::jsonb),
    'tenants', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.tenants t where t.id in (select tenant_id from contracts)
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.billing_period_input_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.billing_period_input_snapshot(uuid) to service_role;


create or replace function public.operations_report_snapshot(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with billing_period as (
    select bp.id, bp.status
    from public.billing_periods bp
    where bp.building_id = p_building_id
      and bp.period_year = p_period_year
      and bp.period_month = p_period_month
    limit 1
  ), invoice_rows as (
    select jsonb_build_object(
      'id', i.id,
      'total_amount', i.total_amount,
      'balance_amount', i.balance_amount,
      'charges', coalesce((
        select jsonb_agg(jsonb_build_object('charge_type', c.charge_type, 'amount', c.amount))
        from public.invoice_charges c where c.invoice_id = i.id
      ), '[]'::jsonb),
      'collected', coalesce((
        select sum(p.amount) from public.invoice_payments p
        where p.invoice_id = i.id and p.deleted_at is null and p.funding_source = 'cash'
      ), 0)
    ) as value
    from public.invoices i
    join billing_period bp on bp.id = i.billing_period_id
    where i.status <> 'void'
  ), fixed_cost_rows as (
    select to_jsonb(c) as value
    from public.building_fixed_costs c
    where c.building_id = p_building_id
      and (c.effective_from_period_year * 12 + c.effective_from_period_month)
          <= (p_period_year * 12 + p_period_month)
      and (
        c.effective_to_period_year is null
        or (c.effective_to_period_year * 12 + c.effective_to_period_month)
           >= (p_period_year * 12 + p_period_month)
      )
  ), expense_rows as (
    select to_jsonb(e) as value
    from public.building_expenses e
    where e.building_id = p_building_id
      and e.period_year = p_period_year
      and e.period_month = p_period_month
      and e.voided_at is null
  ), prepaid_rows as (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', p.category,
      'monthly_amount', case
        when (extract(year from p.start_date)::integer * 12 + extract(month from p.start_date)::integer + p.total_months - 1)
             = (p_period_year * 12 + p_period_month)
          then p.total_amount - p.monthly_amount * (p.total_months - 1)
        else p.monthly_amount
      end
    ) as value
    from public.prepaid_expenses p
    where p.building_id = p_building_id
      and p.start_date <= make_date(p_period_year, p_period_month, 1)
      and p.end_date > make_date(p_period_year, p_period_month, 1)
  ), closure_row as (
    select to_jsonb(op) as value
    from public.operations_report_periods op
    where op.building_id = p_building_id
      and op.period_year = p_period_year
      and op.period_month = p_period_month
    limit 1
  ), fund as (
    select rf.id from public.reserve_funds rf where rf.building_id = p_building_id limit 1
  ), reserve_transactions as (
    select to_jsonb(t) as value
    from public.reserve_fund_transactions t
    join fund f on f.id = t.fund_id
  ), reserve_rate as (
    select to_jsonb(r) as value
    from public.building_reserve_fund_rates r
    where r.building_id = p_building_id
      and (r.effective_from_period_year * 12 + r.effective_from_period_month)
          <= (p_period_year * 12 + p_period_month)
      and (
        r.effective_to_period_year is null
        or (r.effective_to_period_year * 12 + r.effective_to_period_month)
           >= (p_period_year * 12 + p_period_month)
      )
    order by r.effective_from_period_year desc, r.effective_from_period_month desc
    limit 1
  )
  select jsonb_build_object(
    'settlementAllocationTotal', coalesce((select sum(p.amount) from public.invoice_payments p
      join public.invoices i on i.id=p.invoice_id join billing_period bp on bp.id=i.billing_period_id
      where p.deleted_at is null and p.funding_source <> 'cash' and i.status <> 'void'),0),
    'refundTotal', coalesce((select sum(r.amount) from public.contract_checkout_refunds r
      join public.contract_checkout_statements s on s.id=r.statement_id
      join public.contract_checkouts h on h.id=s.checkout_id
      where h.building_id=p_building_id and r.paid_at >= make_date(p_period_year,p_period_month,1)
        and r.paid_at < (make_date(p_period_year,p_period_month,1)+interval '1 month')::date),0),
    'billing_period', coalesce((select jsonb_build_object('id', id, 'status', status) from billing_period), 'null'::jsonb),
    'invoices', coalesce((select jsonb_agg(value) from invoice_rows), '[]'::jsonb),
    'fixed_costs', coalesce((select jsonb_agg(value) from fixed_cost_rows), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(value) from expense_rows), '[]'::jsonb),
    'prepaid_items', coalesce((select jsonb_agg(value) from prepaid_rows), '[]'::jsonb),
    'closure', coalesce((select value from closure_row), 'null'::jsonb),
    'reserve_fund', coalesce((select to_jsonb(f) from fund f), 'null'::jsonb),
    'reserve_transactions', coalesce((select jsonb_agg(value) from reserve_transactions), '[]'::jsonb),
    'reserve_rate', coalesce((select value from reserve_rate), 'null'::jsonb)
  );
$$;


revoke all on function public.operations_report_snapshot(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.operations_report_snapshot(uuid, integer, integer) to service_role;

commit;
