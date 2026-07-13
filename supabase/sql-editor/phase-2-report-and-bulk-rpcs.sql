-- Phase 2 performance: operations-report snapshot and set-based master-data actions.
-- Run this entire file in Supabase Dashboard > SQL Editor.

begin;

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
        where p.invoice_id = i.id and p.deleted_at is null
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
      and p.status = 'active'
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

create or replace function public.bulk_master_data_action(
  p_entity text,
  p_action text,
  p_ids uuid[]
)
returns table (id uuid, succeeded boolean, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  if p_entity = 'room' and p_action in ('archive', 'activate', 'set_maintenance') then
    return query
    with requested as (select unnest(p_ids) as id), updated as (
      update public.rooms r set status = case p_action
        when 'archive' then 'archived'
        when 'activate' then 'available'
        else 'maintenance'
      end
      from requested q where r.id = q.id returning r.id
    )
    select q.id, u.id is not null, case when u.id is null then 'not_found' end
    from requested q left join updated u on u.id = q.id;
    return;
  end if;

  if p_entity = 'tenant' and p_action in ('archive', 'activate') then
    return query
    with requested as (select unnest(p_ids) as id), updated as (
      update public.tenants t set status = case p_action when 'archive' then 'archived' else 'active' end
      from requested q where t.id = q.id returning t.id
    )
    select q.id, u.id is not null, case when u.id is null then 'not_found' end
    from requested q left join updated u on u.id = q.id;
    return;
  end if;

  if p_entity = 'contract' and p_action = 'terminate' then
    return query
    with requested as (select unnest(p_ids) as id), updated as (
      update public.contracts c set status = 'terminated'
      from requested q where c.id = q.id returning c.id
    )
    select q.id, u.id is not null, case when u.id is null then 'not_found' end
    from requested q left join updated u on u.id = q.id;
    return;
  end if;

  raise exception using errcode = '22023', message = 'Unsupported bulk entity/action';
end;
$$;

create index if not exists idx_contracts_building_status_end_date
  on public.contracts (building_id, status, end_date);
create index if not exists idx_meter_readings_room_period_type
  on public.meter_readings (room_id, period_year, period_month, meter_type, reading_type);
create index if not exists idx_invoices_period_status_due_date
  on public.invoices (billing_period_id, status, due_date);
create index if not exists idx_billing_audit_period_created_id
  on public.billing_audit_events (billing_period_id, created_at desc, id desc);

revoke all on function public.operations_report_snapshot(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.bulk_master_data_action(text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.operations_report_snapshot(uuid, integer, integer) to service_role;
grant execute on function public.bulk_master_data_action(text, text, uuid[]) to service_role;

commit;

-- Verification: both rows must show SECURITY INVOKER.
select p.proname, case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('operations_report_snapshot', 'bulk_master_data_action');
