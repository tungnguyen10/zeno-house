begin;

create table public.building_other_incomes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  building_id uuid not null references public.buildings(id),
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  name text not null check (length(btrim(name)) between 1 and 200),
  amount numeric not null check (amount between 1 and 999999999999 and amount = trunc(amount)),
  received_date date not null,
  allocation_target text not null default 'reserve_fund' check (allocation_target in ('reserve_fund','profit')),
  payer text check (length(payer) <= 200),
  payment_method text check (length(payment_method) <= 100),
  transaction_reference text check (length(transaction_reference) <= 100),
  note text check (length(note) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  check (extract(year from received_date) = period_year and extract(month from received_date) = period_month),
  check ((voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null and length(btrim(void_reason)) between 1 and 500))
);

create index building_other_incomes_active_period on public.building_other_incomes
  (building_id, period_year, period_month, received_date desc, created_at desc) where voided_at is null;
create index building_other_incomes_active_reference on public.building_other_incomes
  (building_id, transaction_reference) where transaction_reference is not null and voided_at is null;

-- Reads use the scoped service repository. All writes go through the audited RPC.
alter table public.building_other_incomes enable row level security;
revoke all on public.building_other_incomes from public, anon, authenticated, service_role;
grant select on public.building_other_incomes to service_role;

alter table public.reserve_fund_transactions add column linked_other_income_id uuid
  references public.building_other_incomes(id);
create unique index reserve_fund_transactions_other_income_unique on public.reserve_fund_transactions
  (linked_other_income_id) where source = 'other_income' and voided_at is null;

alter table public.reserve_fund_transactions drop constraint reserve_fund_transactions_source_check,
  add constraint reserve_fund_transactions_source_check check (source in ('manual','monthly_accrual','expense_deduction','other_income'));

-- Keep the installed checks for legacy transaction shapes and audit entity types.
-- Some cloud projects gained additional audit entities via SQL Editor.
do $$
declare old_shape text;
begin
  select pg_get_expr(conbin, conrelid) into strict old_shape from pg_constraint
  where conrelid = 'public.reserve_fund_transactions'::regclass and conname = 'reserve_fund_transactions_source_shape';
  alter table public.reserve_fund_transactions drop constraint reserve_fund_transactions_source_shape;
  execute format('alter table public.reserve_fund_transactions add constraint reserve_fund_transactions_source_shape
    check (((%s) and linked_other_income_id is null) or
      (source = ''other_income'' and type = ''deposit'' and amount > 0 and linked_other_income_id is not null
       and linked_expense_id is null and billing_period_id is null and issued_revenue is null and reserve_rate_percent is null
       and period_year is not null and period_month is not null)) not valid', old_shape);

  select pg_get_expr(conbin, conrelid) into strict old_shape from pg_constraint
  where conrelid = 'public.audit_events'::regclass and conname = 'audit_events_entity_type_check';
  alter table public.audit_events drop constraint audit_events_entity_type_check;
  execute format('alter table public.audit_events add constraint audit_events_entity_type_check
    check ((%s) or entity_type = ''building_other_income'')', old_shape);
end $$;

-- Prevent older browser ledger policies from granting edits to derived deposits.
create policy other_income_deposit_insert on public.reserve_fund_transactions as restrictive
  for insert to authenticated with check (source <> 'other_income');
create policy other_income_deposit_update on public.reserve_fund_transactions as restrictive
  for update to authenticated using (source <> 'other_income') with check (source <> 'other_income');
create policy other_income_deposit_delete on public.reserve_fund_transactions as restrictive
  for delete to authenticated using (source <> 'other_income');

create function public.mutate_building_other_income(
  p_action text, p_income_id uuid, p_payload jsonb, p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_before public.building_other_incomes%rowtype;
  v_income public.building_other_incomes%rowtype;
  v_audit public.audit_events%rowtype;
  v_deposit public.reserve_fund_transactions%rowtype;
  v_fund uuid;
  v_role text;
  v_building uuid;
  v_year integer;
  v_month integer;
  v_operation uuid;
  v_expected timestamptz;
  v_action text;
  v_closed boolean;
  v_duplicate boolean := false;
  v_confirm boolean;
  v_fields text[] := array['name','amount','allocation_target','received_date','payer','payment_method','transaction_reference','note'];
  v_allowed text[];
  v_intent jsonb;
begin
  if p_action is null or p_action not in ('create','update','void') or jsonb_typeof(p_payload) is distinct from 'object'
    or (p_action = 'create') <> (p_income_id is null) then
    raise exception 'OTHER_INCOME_INVALID';
  end if;
  v_allowed := case p_action
    when 'create' then v_fields || array['building_id','period_year','period_month','operation_id','confirm_duplicate']
    when 'update' then v_fields || array['expected_updated_at','confirm_duplicate']
    else array['expected_updated_at','void_reason'] end;
  if p_payload - v_allowed <> '{}'::jsonb
    or (p_action = 'update' and not p_payload ?| v_fields)
    or (p_payload ? 'confirm_duplicate' and jsonb_typeof(p_payload->'confirm_duplicate') <> 'boolean') then
    raise exception 'OTHER_INCOME_INVALID';
  end if;
  v_confirm := coalesce((p_payload->>'confirm_duplicate')::boolean, false);

  select raw_app_meta_data->>'role' into v_role from auth.users where id = p_actor_id;
  if v_role is null or v_role not in ('admin','owner','manager') or (v_role = 'manager' and p_action = 'void') then
    raise exception 'OTHER_INCOME_FORBIDDEN';
  end if;

  if p_action = 'create' then
    v_building := (p_payload->>'building_id')::uuid;
    v_year := (p_payload->>'period_year')::integer;
    v_month := (p_payload->>'period_month')::integer;
    v_operation := (p_payload->>'operation_id')::uuid;
    if v_building is null or v_operation is null or v_year is null or v_month is null
      or v_year not between 2000 and 2100 or v_month not between 1 and 12 then raise exception 'OTHER_INCOME_INVALID'; end if;
  else
    -- Building and period never change. Discover the lock key without holding a row lock.
    select building_id, period_year, period_month into v_building, v_year, v_month
    from public.building_other_incomes where id = p_income_id;
    if not found then raise exception 'OTHER_INCOME_NOT_FOUND'; end if;
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
    if v_expected is null then raise exception 'OTHER_INCOME_INVALID'; end if;
  end if;
  if v_role <> 'admin' and not exists (select from public.user_building_assignments
    where user_id = p_actor_id and building_id = v_building) then raise exception 'OTHER_INCOME_FORBIDDEN'; end if;

  perform pg_advisory_xact_lock(hashtextextended(format('operations-report:%s:%s:%s', v_building, v_year, v_month), 0));
  select status = 'closed' into v_closed from public.operations_report_periods
  where building_id = v_building and period_year = v_year and period_month = v_month for update;

  if p_action = 'create' then
    perform pg_advisory_xact_lock(hashtextextended('other-income-create:' || v_operation::text, 0));
    v_income.allocation_target := 'reserve_fund';
  else
    select * into strict v_before from public.building_other_incomes where id = p_income_id for update;
    v_income := v_before;
  end if;

  if p_action <> 'void' then
    if (p_payload ? 'received_date' and coalesce(p_payload->>'received_date','') !~ '^\d{4}-\d{2}-\d{2}$')
      or (p_payload ? 'amount' and jsonb_typeof(p_payload->'amount') <> 'number')
      or exists (select from jsonb_each(p_payload) f where f.key = any(v_fields)
        and f.key <> 'amount' and jsonb_typeof(f.value) not in ('string','null')) then
      raise exception 'OTHER_INCOME_INVALID';
    end if;
    v_income := jsonb_populate_record(v_income, p_payload);
    v_income.name := nullif(btrim(v_income.name), '');
    v_income.payer := nullif(btrim(v_income.payer), '');
    v_income.payment_method := nullif(btrim(v_income.payment_method), '');
    v_income.transaction_reference := nullif(upper(btrim(v_income.transaction_reference)), '');
    v_income.note := nullif(btrim(v_income.note), '');
    if v_income.name is null or length(v_income.name) > 200 or length(v_income.payer) > 200
      or length(v_income.payment_method) > 100 or length(v_income.transaction_reference) > 100
      or length(v_income.note) > 500 or v_income.amount is null or v_income.amount not between 1 and 999999999999
      or v_income.amount <> trunc(v_income.amount) or v_income.received_date is null
      or extract(year from v_income.received_date) <> v_year or extract(month from v_income.received_date) <> v_month
      or v_income.allocation_target is null or v_income.allocation_target not in ('reserve_fund','profit') then
      raise exception 'OTHER_INCOME_INVALID';
    end if;
  end if;
  if v_role = 'manager' and (v_income.allocation_target = 'reserve_fund' or v_before.allocation_target = 'reserve_fund') then
    raise exception 'OTHER_INCOME_FORBIDDEN';
  end if;

  if p_action = 'create' then
    select * into v_audit from public.audit_events where operation_id = v_operation;
    if found then
      -- The create event remains immutable even after edits, voids, and closing the report.
      v_intent := to_jsonb(v_income) - array['id','created_at','updated_at','created_by','voided_at','voided_by','void_reason'];
      if v_audit.action <> 'building_other_income.created' or v_audit.actor_id is distinct from p_actor_id
        or not (v_audit.after_data @> v_intent)
        or v_audit.metadata->'confirmation_requested' is distinct from to_jsonb(v_confirm) then
        raise exception 'OTHER_INCOME_OPERATION_CONFLICT';
      end if;
      return v_audit.after_data;
    end if;
  end if;

  if v_closed then raise exception 'OTHER_INCOME_PERIOD_CLOSED'; end if;
  if v_before.voided_at is not null then raise exception 'OTHER_INCOME_VOIDED'; end if;
  if p_action <> 'create' and v_before.updated_at <> v_expected then raise exception 'OTHER_INCOME_STALE'; end if;
  if p_action <> 'void' then
    select exists (select from public.building_other_incomes i
      where i.building_id = v_building and i.id is distinct from p_income_id and i.voided_at is null
        and ((i.amount = v_income.amount and i.received_date = v_income.received_date)
          or i.transaction_reference = v_income.transaction_reference))
      or exists (select from public.invoice_payments p join public.invoices i on i.id = p.invoice_id
        join public.billing_periods bp on bp.id = i.billing_period_id
        where bp.building_id = v_building and i.status <> 'void' and p.deleted_at is null and p.funding_source = 'cash'
          and p.paid_at = v_income.received_date and p.amount = v_income.amount) into v_duplicate;
    if v_duplicate and not v_confirm then raise exception 'OTHER_INCOME_DUPLICATE'; end if;
  end if;

  case p_action
    when 'create' then
      insert into public.building_other_incomes (operation_id, building_id, period_year, period_month, name,
        amount, received_date, allocation_target, payer, payment_method, transaction_reference, note, created_by)
      values (v_operation, v_building, v_year, v_month, v_income.name, v_income.amount, v_income.received_date,
        v_income.allocation_target, v_income.payer, v_income.payment_method, v_income.transaction_reference, v_income.note, p_actor_id)
      returning * into v_income;
      v_action := 'building_other_income.created';
    when 'update' then
      update public.building_other_incomes set name = v_income.name, amount = v_income.amount, received_date = v_income.received_date,
        allocation_target = v_income.allocation_target, payer = v_income.payer, payment_method = v_income.payment_method,
        transaction_reference = v_income.transaction_reference, note = v_income.note,
        updated_at = greatest(clock_timestamp(), v_before.updated_at + interval '1 microsecond')
      where id = p_income_id returning * into v_income;
      v_action := 'building_other_income.updated';
    when 'void' then
      if jsonb_typeof(p_payload->'void_reason') is distinct from 'string'
        or length(btrim(p_payload->>'void_reason')) not between 1 and 500 then raise exception 'OTHER_INCOME_INVALID'; end if;
      update public.building_other_incomes set voided_at = clock_timestamp(), voided_by = p_actor_id,
        void_reason = btrim(p_payload->>'void_reason'), updated_at = greatest(clock_timestamp(), v_before.updated_at + interval '1 microsecond')
      where id = p_income_id returning * into v_income;
      v_action := 'building_other_income.voided';
  end case;

  if v_income.allocation_target = 'reserve_fund' and v_income.voided_at is null then
    insert into public.reserve_funds (building_id) values (v_building)
    on conflict (building_id) do update set building_id = excluded.building_id returning id into v_fund;
    insert into public.reserve_fund_transactions (fund_id, type, source, amount, date, period_year, period_month,
      linked_other_income_id, note, created_by)
    values (v_fund, 'deposit', 'other_income', v_income.amount, v_income.received_date, v_year, v_month,
      v_income.id, v_income.name, p_actor_id)
    on conflict (linked_other_income_id) where source = 'other_income' and voided_at is null
    do update set amount = excluded.amount, date = excluded.date, note = excluded.note returning * into v_deposit;
  else
    update public.reserve_fund_transactions set voided_at = clock_timestamp(), voided_by = p_actor_id,
      void_reason = coalesce(v_income.void_reason, 'Reallocated to profit')
    where linked_other_income_id = v_income.id and source = 'other_income' and voided_at is null returning * into v_deposit;
  end if;

  insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id, action,
    entity_type, entity_id, operation_id, before_data, after_data, metadata)
  select b.id, b.name, b.code, p_actor_id, v_action, 'building_other_income', v_income.id, v_operation,
    case when p_action <> 'create' then to_jsonb(v_before) end, to_jsonb(v_income),
    jsonb_build_object('confirmation_requested', v_confirm, 'duplicate_confirmed', v_duplicate and v_confirm,
      'reserve_transaction', case when v_deposit.id is not null then to_jsonb(v_deposit) end)
  from public.buildings b where b.id = v_building;

  return to_jsonb(v_income);
exception when data_exception then
  raise exception 'OTHER_INCOME_INVALID';
end $$;

revoke all on function public.mutate_building_other_income(text,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.mutate_building_other_income(text,uuid,jsonb,uuid) to service_role;

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
    'other_incomes', coalesce((select jsonb_agg(to_jsonb(i) order by i.received_date desc, i.id desc)
      from public.building_other_incomes i where i.building_id = p_building_id and i.period_year = p_period_year
      and i.period_month = p_period_month and i.voided_at is null), '[]'::jsonb),
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
