begin;

create or replace function public.is_valid_contract_amendment_changes(changes jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  change_key text;
begin
  if changes is null or jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb then
    return false;
  end if;

  for change_key in select jsonb_object_keys(changes)
  loop
    if change_key not in (
      'monthly_rent',
      'deposit',
      'payment_due_day',
      'occupant_count',
      'discount_amount',
      'surcharge_amount'
    ) then
      return false;
    end if;
  end loop;

  if changes ? 'monthly_rent' and (
    jsonb_typeof(changes -> 'monthly_rent') <> 'number'
    or (changes ->> 'monthly_rent')::numeric < 0
    or trunc((changes ->> 'monthly_rent')::numeric) <> (changes ->> 'monthly_rent')::numeric
    or (changes ->> 'monthly_rent')::numeric > 999999999999
  ) then return false; end if;
  if changes ? 'deposit' and (
    jsonb_typeof(changes -> 'deposit') <> 'number'
    or (changes ->> 'deposit')::numeric < 0
    or trunc((changes ->> 'deposit')::numeric) <> (changes ->> 'deposit')::numeric
    or (changes ->> 'deposit')::numeric > 999999999999
  ) then return false; end if;
  if changes ? 'payment_due_day' and not (
    jsonb_typeof(changes -> 'payment_due_day') = 'null'
    or (
      jsonb_typeof(changes -> 'payment_due_day') = 'number'
      and (changes ->> 'payment_due_day')::numeric between 1 and 31
      and trunc((changes ->> 'payment_due_day')::numeric) = (changes ->> 'payment_due_day')::numeric
    )
  ) then return false; end if;
  if changes ? 'occupant_count' and (
    jsonb_typeof(changes -> 'occupant_count') <> 'number'
    or (changes ->> 'occupant_count')::numeric < 1
    or trunc((changes ->> 'occupant_count')::numeric) <> (changes ->> 'occupant_count')::numeric
  ) then return false; end if;
  if changes ? 'discount_amount' and (
    jsonb_typeof(changes -> 'discount_amount') <> 'number'
    or (changes ->> 'discount_amount')::numeric < 0
    or trunc((changes ->> 'discount_amount')::numeric) <> (changes ->> 'discount_amount')::numeric
    or (changes ->> 'discount_amount')::numeric > 999999999999
  ) then return false; end if;
  if changes ? 'surcharge_amount' and (
    jsonb_typeof(changes -> 'surcharge_amount') <> 'number'
    or (changes ->> 'surcharge_amount')::numeric < 0
    or trunc((changes ->> 'surcharge_amount')::numeric) <> (changes ->> 'surcharge_amount')::numeric
    or (changes ->> 'surcharge_amount')::numeric > 999999999999
  ) then return false; end if;

  return true;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;

revoke all on function public.is_valid_contract_amendment_changes(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_contract_amendment_changes(jsonb) to service_role;

create table public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  public_content text not null check (char_length(btrim(public_content)) between 1 and 5000),
  effective_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'applied', 'cancelled')),
  changes jsonb not null check (public.is_valid_contract_amendment_changes(changes)),
  before_terms jsonb,
  after_terms jsonb,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  applied_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  applied_at timestamptz,
  cancelled_at timestamptz,
  unique (contract_id, sequence_no),
  constraint contract_amendments_published_snapshot_check check (
    (status = 'draft' and before_terms is null and after_terms is null and published_at is null)
    or
    (status <> 'draft' and before_terms is not null and after_terms is not null and published_at is not null)
  ),
  constraint contract_amendments_applied_fields_check check (
    status <> 'applied' or applied_at is not null
  ),
  constraint contract_amendments_cancelled_fields_check check (
    status <> 'cancelled'
    or (cancelled_at is not null and char_length(btrim(cancellation_reason)) > 0)
  )
);

create unique index contract_amendments_one_scheduled_per_contract
  on public.contract_amendments (contract_id)
  where status = 'scheduled';

create index contract_amendments_contract_timeline
  on public.contract_amendments (contract_id, sequence_no desc);

create index contract_amendments_due
  on public.contract_amendments (effective_date, contract_id)
  where status = 'scheduled';

create trigger contract_amendments_set_updated_at
  before update on public.contract_amendments
  for each row execute function public.set_updated_at();

alter table public.contract_amendments enable row level security;
revoke all on table public.contract_amendments from public, anon, authenticated;
grant select, insert, update, delete on table public.contract_amendments to service_role;

alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;
alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type in (
    'building', 'room', 'tenant', 'contract', 'contract_amendment',
    'contract_renewal', 'building_service', 'contract_service', 'meter_device',
    'user', 'building_expense', 'building_fixed_cost', 'recurring_expense',
    'prepaid_expense', 'support_request', 'contract_occupant', 'contract_payment',
    'service_catalog_item', 'shared_expense', 'reserve_fund', 'reserve_fund_rate',
    'operations_report_period', 'tenant_document'
  ));

create or replace function public.create_contract_amendment_draft(
  p_contract_id uuid,
  p_title text,
  p_public_content text,
  p_effective_date date,
  p_changes jsonb,
  p_actor_id uuid,
  p_operation_id uuid default gen_random_uuid()
)
returns public.contract_amendments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  contract_row public.contracts%rowtype;
  building_name text;
  building_code text;
begin
  select * into contract_row from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;
  if contract_row.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE' using errcode = '23514'; end if;

  insert into public.contract_amendments (
    contract_id, sequence_no, title, public_content, effective_date, changes, created_by
  ) values (
    p_contract_id,
    coalesce((select max(sequence_no) from public.contract_amendments where contract_id = p_contract_id), 0) + 1,
    btrim(p_title), btrim(p_public_content), p_effective_date, p_changes, p_actor_id
  ) returning * into amendment;

  select name, code into building_name, building_code
  from public.buildings where id = contract_row.building_id;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, operation_id, after_data, metadata
  ) values (
    contract_row.building_id, building_name, building_code, p_actor_id,
    'contract_amendment.created', 'contract_amendment', amendment.id,
    p_operation_id, p_operation_id, to_jsonb(amendment),
    jsonb_build_object('contract_id', p_contract_id)
  );
  return amendment;
end;
$$;

create or replace function public.update_contract_amendment_draft(
  p_amendment_id uuid,
  p_title text,
  p_public_content text,
  p_effective_date date,
  p_changes jsonb,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_operation_id uuid default gen_random_uuid()
)
returns public.contract_amendments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  before_row jsonb;
  contract_row public.contracts%rowtype;
  building_name text;
  building_code text;
begin
  select * into amendment from public.contract_amendments where id = p_amendment_id for update;
  if not found then raise exception 'AMENDMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if amendment.status <> 'draft' then raise exception 'AMENDMENT_NOT_DRAFT' using errcode = '23514'; end if;
  if amendment.updated_at <> p_expected_updated_at then raise exception 'AMENDMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  before_row := to_jsonb(amendment);

  update public.contract_amendments
  set title = btrim(p_title), public_content = btrim(p_public_content),
      effective_date = p_effective_date, changes = p_changes
  where id = p_amendment_id returning * into amendment;

  select * into contract_row from public.contracts where id = amendment.contract_id;
  select name, code into building_name, building_code from public.buildings where id = contract_row.building_id;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, operation_id, before_data, after_data, metadata
  ) values (
    contract_row.building_id, building_name, building_code, p_actor_id,
    'contract_amendment.updated', 'contract_amendment', amendment.id,
    p_operation_id, p_operation_id, before_row, to_jsonb(amendment),
    jsonb_build_object('contract_id', amendment.contract_id)
  );
  return amendment;
end;
$$;

create or replace function public.delete_contract_amendment_draft(
  p_amendment_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_operation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  contract_row public.contracts%rowtype;
  building_name text;
  building_code text;
begin
  select * into amendment from public.contract_amendments where id = p_amendment_id for update;
  if not found then raise exception 'AMENDMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if amendment.status <> 'draft' then raise exception 'AMENDMENT_NOT_DRAFT' using errcode = '23514'; end if;
  if amendment.updated_at <> p_expected_updated_at then raise exception 'AMENDMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  select * into contract_row from public.contracts where id = amendment.contract_id;
  select name, code into building_name, building_code from public.buildings where id = contract_row.building_id;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, operation_id, before_data, metadata
  ) values (
    contract_row.building_id, building_name, building_code, p_actor_id,
    'contract_amendment.draft_removed', 'contract_amendment', amendment.id,
    p_operation_id, p_operation_id, to_jsonb(amendment),
    jsonb_build_object('contract_id', amendment.contract_id)
  );
  delete from public.contract_amendments where id = amendment.id;
end;
$$;

create or replace function public.publish_contract_amendment(
  p_amendment_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_today date default current_date,
  p_operation_id uuid default gen_random_uuid()
)
returns public.contract_amendments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  contract_row public.contracts%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
  next_status text;
  building_name text;
  building_code text;
begin
  select * into amendment
  from public.contract_amendments
  where id = p_amendment_id
  for update;

  if not found then raise exception 'AMENDMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if amendment.status <> 'draft' then raise exception 'AMENDMENT_NOT_DRAFT' using errcode = '23514'; end if;
  if amendment.updated_at <> p_expected_updated_at then raise exception 'AMENDMENT_VERSION_CONFLICT' using errcode = '40001'; end if;

  select * into contract_row
  from public.contracts
  where id = amendment.contract_id
  for update;

  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;
  if contract_row.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE' using errcode = '23514'; end if;
  if amendment.effective_date < p_today then raise exception 'AMENDMENT_EFFECTIVE_DATE_IN_PAST' using errcode = '22008'; end if;
  if amendment.effective_date > contract_row.end_date then raise exception 'AMENDMENT_AFTER_CONTRACT_END' using errcode = '22008'; end if;
  if amendment.changes ?| array[
    'monthly_rent', 'payment_due_day', 'occupant_count', 'discount_amount', 'surcharge_amount'
  ] and extract(day from amendment.effective_date) <> 1 then
    raise exception 'AMENDMENT_REQUIRES_MONTH_BOUNDARY' using errcode = '22008';
  end if;
  if exists (
    select 1
    from public.contract_amendments other
    where other.contract_id = amendment.contract_id
      and other.status = 'scheduled'
      and other.id <> amendment.id
  ) then raise exception 'AMENDMENT_ALREADY_SCHEDULED' using errcode = '23505'; end if;
  if exists (
    select 1
    from public.invoices invoice
    join public.billing_periods period on period.id = invoice.billing_period_id
    where invoice.contract_id = amendment.contract_id
      and invoice.status <> 'void'
      and period.period_year = extract(year from amendment.effective_date)::integer
      and period.period_month = extract(month from amendment.effective_date)::integer
  ) then raise exception 'AMENDMENT_INVOICE_CONFLICT' using errcode = '23514'; end if;

  before_snapshot := jsonb_build_object(
    'monthly_rent', contract_row.monthly_rent,
    'deposit', contract_row.deposit,
    'payment_due_day', contract_row.payment_due_day,
    'occupant_count', contract_row.occupant_count,
    'discount_amount', contract_row.discount_amount,
    'surcharge_amount', contract_row.surcharge_amount
  );
  after_snapshot := before_snapshot || amendment.changes;
  next_status := case when amendment.effective_date = p_today then 'applied' else 'scheduled' end;

  update public.contract_amendments
  set status = next_status,
      before_terms = before_snapshot,
      after_terms = after_snapshot,
      published_by = p_actor_id,
      published_at = now(),
      applied_by = case when next_status = 'applied' then p_actor_id else null end,
      applied_at = case when next_status = 'applied' then now() else null end
  where id = amendment.id
  returning * into amendment;

  if next_status = 'applied' then
    update public.contracts
    set monthly_rent = (after_snapshot ->> 'monthly_rent')::numeric,
        deposit = (after_snapshot ->> 'deposit')::numeric,
        payment_due_day = case
          when jsonb_typeof(after_snapshot -> 'payment_due_day') = 'null' then null
          else (after_snapshot ->> 'payment_due_day')::smallint
        end,
        occupant_count = (after_snapshot ->> 'occupant_count')::integer,
        discount_amount = (after_snapshot ->> 'discount_amount')::numeric,
        surcharge_amount = (after_snapshot ->> 'surcharge_amount')::numeric
    where id = contract_row.id;
  end if;

  select name, code into building_name, building_code
  from public.buildings where id = contract_row.building_id;

  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, operation_id,
    before_data, after_data, metadata
  ) values (
    contract_row.building_id, building_name, building_code, p_actor_id,
    case when next_status = 'applied' then 'contract.amendment.applied' else 'contract.amendment.published' end,
    'contract_amendment', amendment.id, p_operation_id, p_operation_id,
    before_snapshot, after_snapshot,
    jsonb_build_object('contract_id', contract_row.id, 'effective_date', amendment.effective_date)
  );

  if next_status = 'applied' then
    insert into public.audit_events (
      building_id, building_name_snapshot, building_code_snapshot, actor_id,
      action, entity_type, entity_id, correlation_id, before_data, after_data, metadata
    ) values (
      contract_row.building_id, building_name, building_code, p_actor_id,
      'contract.updated', 'contract', contract_row.id, p_operation_id,
      before_snapshot, after_snapshot,
      jsonb_build_object('source', 'contract_amendment', 'amendment_id', amendment.id)
    );
  end if;

  return amendment;
end;
$$;

create or replace function public.cancel_contract_amendment(
  p_amendment_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_reason text,
  p_operation_id uuid default gen_random_uuid()
)
returns public.contract_amendments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  contract_row public.contracts%rowtype;
  building_name text;
  building_code text;
begin
  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'AMENDMENT_CANCEL_REASON_REQUIRED' using errcode = '23514';
  end if;

  select * into amendment from public.contract_amendments
  where id = p_amendment_id for update;
  if not found then raise exception 'AMENDMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if amendment.status <> 'scheduled' then raise exception 'AMENDMENT_NOT_SCHEDULED' using errcode = '23514'; end if;
  if amendment.updated_at <> p_expected_updated_at then raise exception 'AMENDMENT_VERSION_CONFLICT' using errcode = '40001'; end if;

  select * into contract_row from public.contracts
  where id = amendment.contract_id for update;

  update public.contract_amendments
  set status = 'cancelled', cancelled_by = p_actor_id,
      cancellation_reason = btrim(p_reason), cancelled_at = now()
  where id = amendment.id
  returning * into amendment;

  select name, code into building_name, building_code
  from public.buildings where id = contract_row.building_id;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, operation_id,
    before_data, after_data, metadata
  ) values (
    contract_row.building_id, building_name, building_code, p_actor_id,
    'contract.amendment.cancelled', 'contract_amendment', amendment.id,
    p_operation_id, p_operation_id, amendment.before_terms, amendment.after_terms,
    jsonb_build_object('contract_id', contract_row.id, 'reason', amendment.cancellation_reason)
  );
  return amendment;
end;
$$;

create or replace function public.enforce_contract_amendment_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  operation_id uuid;
  reason text;
  building_name text;
  building_code text;
begin
  select name, code into building_name, building_code
  from public.buildings where id = old.building_id;

  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.contract_amendments
      where contract_id = old.id and status <> 'draft'
    ) then
      raise exception 'CONTRACT_HAS_PUBLISHED_AMENDMENTS' using errcode = '23503';
    end if;

    for amendment in
      select * from public.contract_amendments
      where contract_id = old.id and status = 'draft'
      for update
    loop
      operation_id := gen_random_uuid();
      insert into public.audit_events (
        building_id, building_name_snapshot, building_code_snapshot,
        action, entity_type, entity_id, correlation_id, operation_id,
        before_data, metadata
      ) values (
        old.building_id, building_name, building_code,
        'contract_amendment.draft_removed', 'contract_amendment', amendment.id,
        operation_id, operation_id, to_jsonb(amendment),
        jsonb_build_object('contract_id', old.id, 'reason', 'contract_deleted')
      );
    end loop;
    delete from public.contract_amendments where contract_id = old.id and status = 'draft';
    return old;
  end if;

  if old.status = 'active'
    and (new.status in ('terminated', 'renewed') or new.end_date is distinct from old.end_date)
  then
    reason := case
      when new.status = 'terminated' then 'Hợp đồng đã chấm dứt'
      when new.status = 'renewed' then 'Hợp đồng đã được gia hạn thành hợp đồng mới'
      else 'Hợp đồng đã được gia hạn'
    end;

    for amendment in
      select * from public.contract_amendments
      where contract_id = old.id and status = 'scheduled'
      for update
    loop
      operation_id := gen_random_uuid();
      update public.contract_amendments
      set status = 'cancelled', cancellation_reason = reason, cancelled_at = now()
      where id = amendment.id;
      insert into public.audit_events (
        building_id, building_name_snapshot, building_code_snapshot,
        action, entity_type, entity_id, correlation_id, operation_id,
        before_data, after_data, metadata
      ) values (
        old.building_id, building_name, building_code,
        'contract.amendment.cancelled', 'contract_amendment', amendment.id,
        operation_id, operation_id, amendment.before_terms, amendment.after_terms,
        jsonb_build_object('contract_id', old.id, 'reason', reason, 'source', 'contract_lifecycle')
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger contracts_enforce_amendment_lifecycle
  before update or delete on public.contracts
  for each row execute function public.enforce_contract_amendment_lifecycle();

create or replace function public.apply_due_contract_amendments(
  p_as_of date default current_date,
  p_building_id uuid default null
)
returns setof public.contract_amendments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  amendment public.contract_amendments%rowtype;
  contract_row public.contracts%rowtype;
  operation_id uuid;
  building_name text;
  building_code text;
begin
  for amendment in
    select candidate.*
    from public.contract_amendments candidate
    join public.contracts contract on contract.id = candidate.contract_id
    where candidate.status = 'scheduled'
      and candidate.effective_date <= p_as_of
      and (p_building_id is null or contract.building_id = p_building_id)
    order by candidate.effective_date, candidate.id
    for update skip locked
  loop
    begin
      select * into contract_row from public.contracts
      where id = amendment.contract_id for update;
      if contract_row.status <> 'active' then
        raise exception 'CONTRACT_NOT_ACTIVE' using errcode = '23514';
      end if;

      update public.contracts
      set monthly_rent = (amendment.after_terms ->> 'monthly_rent')::numeric,
          deposit = (amendment.after_terms ->> 'deposit')::numeric,
          payment_due_day = case
            when jsonb_typeof(amendment.after_terms -> 'payment_due_day') = 'null' then null
            else (amendment.after_terms ->> 'payment_due_day')::smallint
          end,
          occupant_count = (amendment.after_terms ->> 'occupant_count')::integer,
          discount_amount = (amendment.after_terms ->> 'discount_amount')::numeric,
          surcharge_amount = (amendment.after_terms ->> 'surcharge_amount')::numeric
      where id = contract_row.id;

      update public.contract_amendments
      set status = 'applied', applied_at = now()
      where id = amendment.id and status = 'scheduled'
      returning * into amendment;

      operation_id := gen_random_uuid();
      select name, code into building_name, building_code
      from public.buildings where id = contract_row.building_id;

      insert into public.audit_events (
        building_id, building_name_snapshot, building_code_snapshot,
        action, entity_type, entity_id, correlation_id, operation_id,
        before_data, after_data, metadata
      ) values (
        contract_row.building_id, building_name, building_code,
        'contract.amendment.applied', 'contract_amendment', amendment.id,
        operation_id, operation_id, amendment.before_terms, amendment.after_terms,
        jsonb_build_object('contract_id', contract_row.id, 'source', 'scheduler')
      );
      insert into public.audit_events (
        building_id, building_name_snapshot, building_code_snapshot,
        action, entity_type, entity_id, correlation_id,
        before_data, after_data, metadata
      ) values (
        contract_row.building_id, building_name, building_code,
        'contract.updated', 'contract', contract_row.id, operation_id,
        amendment.before_terms, amendment.after_terms,
        jsonb_build_object('source', 'contract_amendment', 'amendment_id', amendment.id)
      );

      return next amendment;
    exception when others then
      raise warning 'Unable to apply contract amendment %: %', amendment.id, sqlerrm;
    end;
  end loop;
  return;
end;
$$;

revoke all on function public.publish_contract_amendment(uuid, timestamptz, uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.cancel_contract_amendment(uuid, timestamptz, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.apply_due_contract_amendments(date, uuid) from public, anon, authenticated;
revoke all on function public.create_contract_amendment_draft(uuid, text, text, date, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_contract_amendment_draft(uuid, text, text, date, jsonb, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_contract_amendment_draft(uuid, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public.enforce_contract_amendment_lifecycle() from public, anon, authenticated;
grant execute on function public.publish_contract_amendment(uuid, timestamptz, uuid, date, uuid) to service_role;
grant execute on function public.cancel_contract_amendment(uuid, timestamptz, uuid, text, uuid) to service_role;
grant execute on function public.apply_due_contract_amendments(date, uuid) to service_role;
grant execute on function public.create_contract_amendment_draft(uuid, text, text, date, jsonb, uuid, uuid) to service_role;
grant execute on function public.update_contract_amendment_draft(uuid, text, text, date, jsonb, timestamptz, uuid, uuid) to service_role;
grant execute on function public.delete_contract_amendment_draft(uuid, timestamptz, uuid, uuid) to service_role;

commit;

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'contract-amendments-apply-due'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'contract-amendments-apply-due',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'nitro_scheduler_base_url'
      ) || '/api/internal/contracts/amendments/apply-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-contract-amendments-secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'contract_amendments_apply_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
