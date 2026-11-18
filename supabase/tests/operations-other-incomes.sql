-- Run against an isolated test project with an existing test building. All changes roll back.
begin;

create function pg_temp.expect_income_error(
  expected text, action text, income_id uuid, payload jsonb, actor uuid
) returns void language plpgsql as $$
begin
  perform public.mutate_building_other_income(action, income_id, payload, actor);
  raise exception 'Expected % but mutation succeeded', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end $$;

do $$
declare
  building uuid;
  actor uuid := gen_random_uuid();
  manager uuid := gen_random_uuid();
  operation uuid := gen_random_uuid();
  payload jsonb;
  income jsonb;
  income_id uuid;
  original_version jsonb;
  duplicate jsonb;
  snapshot jsonb;
begin
  select id into strict building from public.buildings order by id limit 1;
  insert into auth.users (id, raw_app_meta_data) values
    (actor, '{"role":"admin"}'), (manager, '{"role":"manager"}');
  payload := jsonb_build_object('operation_id', operation, 'building_id', building,
    'period_year', 2097, 'period_month', 11, 'received_date', '2097-11-11',
    'name', 'Fixture receipt', 'amount', 507, 'transaction_reference', ' tx-abc ');
  if exists (select 1 from public.operations_report_periods where building_id = building
    and period_year = 2097 and period_month = 11) then
    raise exception 'Test requires unused November 2097';
  end if;

  perform pg_temp.expect_income_error('OTHER_INCOME_FORBIDDEN', 'create', null,
    payload || '{"allocation_target":"profit"}', manager);
  insert into public.user_building_assignments (user_id, building_id) values (manager, building);
  perform pg_temp.expect_income_error('OTHER_INCOME_FORBIDDEN', 'create', null, payload, manager);
  perform pg_temp.expect_income_error('OTHER_INCOME_INVALID', 'create', null, payload || '{"amount":1.5}', actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_INVALID', 'create', null, payload || '{"amount":0}', actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_INVALID', 'create', null, payload || '{"received_date":"2097-11-31"}', actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_INVALID', 'create', null, payload || '{"received_date":"2097-12-01"}', actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_INVALID', 'create', null,
    payload || jsonb_build_object('invoice_id', gen_random_uuid()), actor);

  income := public.mutate_building_other_income('create', null, payload, actor);
  income_id := (income->>'id')::uuid;
  original_version := income->'updated_at';
  if income->>'allocation_target' <> 'reserve_fund' or income->>'transaction_reference' <> 'TX-ABC'
    or public.mutate_building_other_income('create', null, payload, actor) <> income
    or (select count(*) from public.audit_events where entity_id = income_id) <> 1
    or (select count(*) from public.reserve_fund_transactions where linked_other_income_id = income_id
      and type = 'deposit' and amount = 507 and voided_at is null) <> 1 then
    raise exception 'Create/replay did not produce one canonical receipt, deposit, and event';
  end if;
  perform pg_temp.expect_income_error('OTHER_INCOME_OPERATION_CONFLICT', 'create', null, payload || '{"amount":508}', actor);
  duplicate := payload || jsonb_build_object('operation_id', gen_random_uuid(), 'allocation_target', 'profit');
  perform pg_temp.expect_income_error('OTHER_INCOME_DUPLICATE', 'create', null, duplicate, manager);
  perform pg_temp.expect_income_error('OTHER_INCOME_DUPLICATE', 'create', null,
    duplicate || '{"amount":800,"received_date":"2097-11-15"}', manager);
  duplicate := public.mutate_building_other_income('create', null, duplicate || '{"confirm_duplicate":true}', manager);
  if not exists (select 1 from public.audit_events where entity_id = (duplicate->>'id')::uuid
      and metadata @> '{"duplicate_confirmed":true}') then raise exception 'Missing duplicate confirmation audit'; end if;

  perform pg_temp.expect_income_error('OTHER_INCOME_FORBIDDEN', 'update', income_id,
    jsonb_build_object('expected_updated_at', original_version, 'allocation_target', 'profit'), manager);
  income := public.mutate_building_other_income('update', income_id, jsonb_build_object(
    'expected_updated_at', original_version, 'allocation_target', 'profit', 'confirm_duplicate', true), actor);
  if exists (select from public.reserve_fund_transactions where linked_other_income_id = income_id and voided_at is null)
    then raise exception 'Profit receipt retained active deposit'; end if;
  perform pg_temp.expect_income_error('OTHER_INCOME_STALE', 'update', income_id,
    jsonb_build_object('expected_updated_at', original_version, 'amount', 100), actor);
  income := public.mutate_building_other_income('update', income_id, jsonb_build_object(
    'expected_updated_at', income->'updated_at', 'allocation_target', 'reserve_fund',
    'amount', 815, 'confirm_duplicate', true), actor);
  if (select count(*) from public.reserve_fund_transactions where linked_other_income_id = income_id
    and voided_at is null and amount = 815) <> 1 then raise exception 'Reserve reassignment failed'; end if;
  if public.mutate_building_other_income('create', null, payload, actor)->>'id' <> income_id::text
    then raise exception 'Lost original create replay after an edit'; end if;

  perform public.close_operations_report_with_audit(building, 2097, 11, null, 0, 0, 0, 'manual', actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_PERIOD_CLOSED', 'create', null,
    payload || jsonb_build_object('operation_id', gen_random_uuid()), actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_PERIOD_CLOSED', 'update', income_id,
    jsonb_build_object('expected_updated_at', income->'updated_at', 'name', 'Closed edit'), actor);
  perform pg_temp.expect_income_error('OTHER_INCOME_PERIOD_CLOSED', 'void', income_id,
    jsonb_build_object('expected_updated_at', income->'updated_at', 'void_reason', 'Duplicate'), actor);
  perform public.reopen_operations_report_with_audit(building, 2097, 11, actor, 'Test correction');
  snapshot := public.operations_report_snapshot(building, 2097, 11);
  if jsonb_array_length(snapshot->'other_incomes') is distinct from 2
    or (select count(*) from public.reserve_fund_transactions where linked_other_income_id = income_id
      and voided_at is null) <> 1 then raise exception 'Reopen lost receipt or deposit'; end if;
  income := public.mutate_building_other_income('void', income_id, jsonb_build_object(
    'expected_updated_at', income->'updated_at', 'void_reason', 'Duplicate receipt'), actor);
  if income->>'voided_at' is null or exists (select from public.reserve_fund_transactions
      where linked_other_income_id = income_id and voided_at is null)
    or jsonb_array_length(public.operations_report_snapshot(building, 2097, 11)->'other_incomes') <> 1
    then raise exception 'Void left active money'; end if;

  create function pg_temp.fail_income_audit() returns trigger language plpgsql as $fail$
    begin raise exception 'INJECTED_AUDIT_FAILURE'; end $fail$;
  create trigger test_other_income_audit before insert on public.audit_events
    for each row when (new.entity_type = 'building_other_income') execute function pg_temp.fail_income_audit();
  operation := gen_random_uuid();
  perform pg_temp.expect_income_error('INJECTED_AUDIT_FAILURE', 'create', null,
    payload || jsonb_build_object('operation_id', operation, 'name', 'Rollback fixture', 'confirm_duplicate', true), actor);
  if exists (select from public.building_other_incomes where operation_id = operation)
    or exists (select from public.reserve_fund_transactions where note = 'Rollback fixture') then
    raise exception 'Audit failure left partial money movement';
  end if;
  if has_function_privilege('authenticated', 'public.mutate_building_other_income(text,uuid,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.mutate_building_other_income(text,uuid,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.mutate_building_other_income(text,uuid,jsonb,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.building_other_incomes', 'INSERT')
    then raise exception 'Incorrect grants'; end if;
end $$;
rollback;
