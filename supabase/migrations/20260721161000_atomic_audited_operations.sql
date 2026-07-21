begin;

create or replace function public.allocate_shared_expense(
  p_shared_expense_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_actor_id uuid
)
returns table (building_id uuid, expense_id uuid, amount numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shared public.shared_expenses%rowtype;
  v_building_ids uuid[];
  v_count integer;
  v_base numeric(12, 0);
  v_remainder numeric(12, 0);
  v_marker text;
begin
  if p_period_year not between 2000 and 2100 or p_period_month not between 1 and 12 then
    raise exception using errcode = '22023', message = 'Invalid allocation period';
  end if;

  select * into v_shared
  from public.shared_expenses
  where id = p_shared_expense_id and is_active = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Shared expense not found';
  end if;

  select array_agg(seb.building_id order by seb.created_at, seb.building_id)
  into v_building_ids
  from public.shared_expense_buildings seb
  where seb.shared_expense_id = p_shared_expense_id;

  v_count := coalesce(array_length(v_building_ids, 1), 0);
  if v_count = 0 then
    raise exception using errcode = '22023', message = 'Shared expense has no buildings';
  end if;

  if exists (
    select 1 from public.operations_report_periods p
    where p.building_id = any(v_building_ids)
      and p.period_year = p_period_year
      and p.period_month = p_period_month
      and p.status = 'closed'
  ) then
    raise exception using errcode = 'P0001', message = 'An operations report period is closed';
  end if;

  v_marker := format('[shared:%s:%s-%s]', p_shared_expense_id, p_period_year, lpad(p_period_month::text, 2, '0'));
  if exists (select 1 from public.building_expenses e where e.note like '%' || v_marker || '%') then
    raise exception using errcode = '23505', message = 'Shared expense period already allocated';
  end if;

  v_base := floor(v_shared.amount / v_count);
  v_remainder := v_shared.amount - (v_base * v_count);

  return query
  with allocations as (
    select item.building_id, item.ordinality,
      v_base + case when item.ordinality = v_count then v_remainder else 0 end as allocated_amount
    from unnest(v_building_ids) with ordinality as item(building_id, ordinality)
  ), inserted_expenses as (
    insert into public.building_expenses as expense (
      building_id, period_year, period_month, expense_date, category, amount,
      note, payee, payment_method, funded_by, created_by
    )
    select a.building_id, p_period_year, p_period_month, null, v_shared.category,
      a.allocated_amount, v_marker || ' ' || v_shared.name, null, null, 'direct', p_actor_id
    from allocations a
    returning expense.building_id, expense.id, expense.amount
  ), parent_event as (
    insert into public.audit_events (
      building_id, actor_id, action, entity_type, entity_id, metadata
    ) values (
      null, p_actor_id, 'shared_expense.allocated', 'shared_expense', p_shared_expense_id,
      jsonb_build_object('period_year', p_period_year, 'period_month', p_period_month, 'building_ids', v_building_ids)
    ) returning id
  ), child_events as (
    insert into public.audit_events (
      building_id, actor_id, action, entity_type, entity_id, correlation_id, after_data,
      metadata
    )
    select generated.building_id, p_actor_id, 'building_expense.created', 'building_expense',
      generated.id, parent_event.id,
      jsonb_build_object('id', generated.id, 'building_id', generated.building_id, 'amount', generated.amount),
      jsonb_build_object('source', 'shared_expense', 'shared_expense_id', p_shared_expense_id,
        'period_year', p_period_year, 'period_month', p_period_month)
    from inserted_expenses generated cross join parent_event
    returning id
  )
  select generated.building_id, generated.id, generated.amount
  from inserted_expenses generated
  cross join (select count(*) from child_events) ensured_audit;
end;
$$;

revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from public;
revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from anon;
revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from authenticated;
grant execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) to service_role;

create or replace function public.create_reserve_funded_expense_with_audit(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_expense_date date,
  p_category text,
  p_amount numeric,
  p_payee text,
  p_payment_method text,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense public.building_expenses%rowtype;
  v_fund_id uuid;
  v_deduction public.reserve_fund_transactions%rowtype;
begin
  insert into public.building_expenses (
    building_id, period_year, period_month, expense_date, category, amount,
    payee, payment_method, note, funded_by, created_by
  ) values (
    p_building_id, p_period_year, p_period_month, p_expense_date, p_category, p_amount,
    p_payee, p_payment_method, p_note, 'reserve_fund', p_actor_id
  ) returning * into v_expense;

  insert into public.reserve_funds (building_id)
  values (p_building_id)
  on conflict (building_id) do update set building_id = excluded.building_id
  returning id into v_fund_id;

  insert into public.reserve_fund_transactions (
    fund_id, type, source, amount, date, period_year, period_month,
    linked_expense_id, note, created_by
  ) values (
    v_fund_id, 'withdrawal', 'expense_deduction', p_amount,
    coalesce(p_expense_date, current_date), p_period_year, p_period_month,
    v_expense.id, coalesce(p_note, format('Expense %s', v_expense.id)), p_actor_id
  ) returning * into v_deduction;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, after_data, metadata
  ) values (
    p_building_id, p_actor_id, 'building_expense.created', 'building_expense',
    v_expense.id, to_jsonb(v_expense),
    jsonb_build_object('reserve_deduction', to_jsonb(v_deduction))
  );

  return jsonb_build_object(
    'expense', to_jsonb(v_expense),
    'deduction', to_jsonb(v_deduction)
  );
end;
$$;

revoke execute on function public.create_reserve_funded_expense_with_audit(uuid, integer, integer, date, text, numeric, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_reserve_funded_expense_with_audit(uuid, integer, integer, date, text, numeric, text, text, text, uuid) to service_role;

create or replace function public.sync_contract_services_from_building(
  p_building_id uuid,
  p_actor_id uuid
)
returns table (change_id uuid, change_action text)
language sql
security invoker
set search_path = ''
as $$
  with active_contracts as materialized (
    select contract.id
    from public.contracts contract
    join public.rooms room on room.id = contract.room_id
    where room.building_id = p_building_id and contract.status = 'active'
  ), building_defaults as materialized (
    select service.catalog_id, service.default_amount, service.is_active
    from public.building_services service
    where service.building_id = p_building_id
  ), existing as materialized (
    select service.*
    from public.contract_services service
    join active_contracts contract on contract.id = service.contract_id
  ), inserted as (
    insert into public.contract_services as service (
      contract_id, catalog_id, amount, quantity, is_enabled
    )
    select contract.id, defaults.catalog_id, defaults.default_amount, 1, true
    from active_contracts contract
    cross join building_defaults defaults
    where defaults.is_active
      and not exists (
        select 1 from existing current
        where current.contract_id = contract.id and current.catalog_id = defaults.catalog_id
      )
    returning service.id, null::jsonb as before_data, to_jsonb(service) as after_data,
      'contract_service.created'::text as action
  ), pending_updates as materialized (
    select current.id, to_jsonb(current) as before_data,
      coalesce(defaults.is_active, false) as should_enable
    from existing current
    left join building_defaults defaults on defaults.catalog_id = current.catalog_id
    where current.is_enabled is distinct from coalesce(defaults.is_active, false)
  ), updated as (
    update public.contract_services as service
    set is_enabled = pending.should_enable, updated_at = now()
    from pending_updates pending
    where service.id = pending.id
    returning service.id, pending.before_data, to_jsonb(service) as after_data,
      'contract_service.updated'::text as action
  ), changes as materialized (
    select * from inserted union all select * from updated
  ), parent_event as (
    insert into public.audit_events (
      building_id, actor_id, action, entity_type, entity_id, metadata
    )
    select p_building_id, p_actor_id, 'contract_service.synced', 'contract_service', null,
      jsonb_build_object('changed_count', count(*))
    from changes
    returning id
  ), child_events as (
    insert into public.audit_events (
      building_id, actor_id, action, entity_type, entity_id, correlation_id,
      before_data, after_data, metadata
    )
    select p_building_id, p_actor_id, changes.action, 'contract_service', changes.id,
      parent_event.id, changes.before_data, changes.after_data,
      jsonb_build_object('source', 'building_service_sync')
    from changes cross join parent_event
    returning entity_id, action
  )
  select child_events.entity_id as change_id, child_events.action as change_action
  from child_events;
$$;

revoke execute on function public.sync_contract_services_from_building(uuid, uuid) from public;
revoke execute on function public.sync_contract_services_from_building(uuid, uuid) from anon;
revoke execute on function public.sync_contract_services_from_building(uuid, uuid) from authenticated;
grant execute on function public.sync_contract_services_from_building(uuid, uuid) to service_role;

create or replace function public.close_operations_report_with_audit(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_billing_period_id uuid,
  p_issued_revenue numeric,
  p_reserve_rate_percent numeric,
  p_accrual_amount numeric,
  p_close_source text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fund_id uuid;
  v_accrual public.reserve_fund_transactions%rowtype;
  v_period public.operations_report_periods%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    format('operations-report:%s:%s:%s', p_building_id, p_period_year, p_period_month), 0
  ));
  select * into v_period
  from public.operations_report_periods
  where building_id = p_building_id
    and period_year = p_period_year
    and period_month = p_period_month
  for update;
  if found and v_period.status = 'closed' then
    if p_close_source = 'auto' then
      return to_jsonb(v_period);
    end if;
    raise exception using errcode = 'P0001', message = 'Operations report is already closed';
  end if;

  insert into public.reserve_funds (building_id)
  values (p_building_id)
  on conflict (building_id) do update set building_id = excluded.building_id
  returning id into v_fund_id;

  insert into public.reserve_fund_transactions as transaction (
    fund_id, type, source, amount, date, period_year, period_month,
    billing_period_id, reserve_rate_percent, issued_revenue, linked_expense_id,
    note, created_by, voided_at, voided_by, void_reason
  ) values (
    v_fund_id, 'deposit', 'monthly_accrual', p_accrual_amount,
    make_date(p_period_year, p_period_month, 1), p_period_year, p_period_month,
    p_billing_period_id, p_reserve_rate_percent, p_issued_revenue, null,
    format('Reserve accrual %s-%s', p_period_year, lpad(p_period_month::text, 2, '0')),
    p_actor_id, null, null, null
  )
  on conflict (fund_id, period_year, period_month) where source = 'monthly_accrual'
  do update set
    amount = excluded.amount,
    billing_period_id = excluded.billing_period_id,
    reserve_rate_percent = excluded.reserve_rate_percent,
    issued_revenue = excluded.issued_revenue,
    created_by = excluded.created_by,
    voided_at = null,
    voided_by = null,
    void_reason = null
  returning transaction.* into v_accrual;

  insert into public.operations_report_periods as period (
    building_id, period_year, period_month, status, close_source, closed_at, closed_by
  ) values (
    p_building_id, p_period_year, p_period_month, 'closed', p_close_source, now(), p_actor_id
  )
  on conflict (building_id, period_year, period_month) do update set
    status = 'closed', close_source = excluded.close_source,
    closed_at = excluded.closed_at, closed_by = excluded.closed_by
  returning period.* into v_period;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, after_data, metadata
  ) values (
    p_building_id, p_actor_id,
    case when p_close_source = 'auto' then 'operations_report_period.auto_closed'
      else 'operations_report_period.closed' end,
    'operations_report_period', v_period.id, to_jsonb(v_period),
    jsonb_build_object(
      'period_year', p_period_year, 'period_month', p_period_month,
      'close_source', p_close_source, 'accrual_snapshot', to_jsonb(v_accrual)
    )
  );

  return to_jsonb(v_period);
end;
$$;

create or replace function public.refresh_reserve_accrual_with_audit(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_billing_period_id uuid,
  p_issued_revenue numeric,
  p_reserve_rate_percent numeric,
  p_accrual_amount numeric,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fund_id uuid;
  v_before jsonb;
  v_accrual public.reserve_fund_transactions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    format('operations-report:%s:%s:%s', p_building_id, p_period_year, p_period_month), 0
  ));
  insert into public.reserve_funds (building_id)
  values (p_building_id)
  on conflict (building_id) do update set building_id = excluded.building_id
  returning id into v_fund_id;

  select to_jsonb(transaction) into v_before
  from public.reserve_fund_transactions transaction
  where transaction.fund_id = v_fund_id and transaction.source = 'monthly_accrual'
    and transaction.period_year = p_period_year and transaction.period_month = p_period_month
  for update;

  insert into public.reserve_fund_transactions as transaction (
    fund_id, type, source, amount, date, period_year, period_month,
    billing_period_id, reserve_rate_percent, issued_revenue, linked_expense_id,
    note, created_by, voided_at, voided_by, void_reason
  ) values (
    v_fund_id, 'deposit', 'monthly_accrual', p_accrual_amount,
    make_date(p_period_year, p_period_month, 1), p_period_year, p_period_month,
    p_billing_period_id, p_reserve_rate_percent, p_issued_revenue, null,
    format('Reserve accrual %s-%s', p_period_year, lpad(p_period_month::text, 2, '0')),
    p_actor_id, null, null, null
  )
  on conflict (fund_id, period_year, period_month) where source = 'monthly_accrual'
  do update set amount = excluded.amount, billing_period_id = excluded.billing_period_id,
    reserve_rate_percent = excluded.reserve_rate_percent, issued_revenue = excluded.issued_revenue,
    created_by = excluded.created_by, voided_at = null, voided_by = null, void_reason = null
  returning transaction.* into v_accrual;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    p_building_id, p_actor_id, 'reserve_fund.accrual_refreshed', 'reserve_fund', v_fund_id,
    v_before, to_jsonb(v_accrual),
    jsonb_build_object('period_year', p_period_year, 'period_month', p_period_month)
  );
  return to_jsonb(v_accrual);
end;
$$;

create or replace function public.reopen_operations_report_with_audit(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before public.operations_report_periods%rowtype;
  v_after public.operations_report_periods%rowtype;
  v_retained_accrual jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    format('operations-report:%s:%s:%s', p_building_id, p_period_year, p_period_month), 0
  ));
  select * into v_before
  from public.operations_report_periods
  where building_id = p_building_id and period_year = p_period_year and period_month = p_period_month
  for update;
  if not found or v_before.status <> 'closed' then
    raise exception using errcode = 'P0001', message = 'Operations report is not closed';
  end if;

  select to_jsonb(transaction) into v_retained_accrual
  from public.reserve_fund_transactions transaction
  join public.reserve_funds fund on fund.id = transaction.fund_id
  where fund.building_id = p_building_id
    and transaction.source = 'monthly_accrual'
    and transaction.period_year = p_period_year
    and transaction.period_month = p_period_month
    and transaction.voided_at is null
  for update of transaction;

  update public.operations_report_periods
  set status = 'open', close_source = null, closed_at = null, closed_by = null,
    reopened_at = now(), reopened_by = p_actor_id, reopen_reason = p_reason
  where id = v_before.id
  returning * into v_after;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    p_building_id, p_actor_id, 'operations_report_period.reopened',
    'operations_report_period', v_after.id, to_jsonb(v_before), to_jsonb(v_after),
    jsonb_build_object(
      'period_year', p_period_year,
      'period_month', p_period_month,
      'reason', p_reason,
      'retained_accrual_snapshot', v_retained_accrual
    )
  );
  return to_jsonb(v_after);
end;
$$;

revoke execute on function public.close_operations_report_with_audit(uuid, integer, integer, uuid, numeric, numeric, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.close_operations_report_with_audit(uuid, integer, integer, uuid, numeric, numeric, numeric, text, uuid) to service_role;
revoke execute on function public.refresh_reserve_accrual_with_audit(uuid, integer, integer, uuid, numeric, numeric, numeric, uuid) from public, anon, authenticated;
grant execute on function public.refresh_reserve_accrual_with_audit(uuid, integer, integer, uuid, numeric, numeric, numeric, uuid) to service_role;
revoke execute on function public.reopen_operations_report_with_audit(uuid, integer, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_operations_report_with_audit(uuid, integer, integer, uuid, text) to service_role;

commit;
