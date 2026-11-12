-- ZH-BIL-01 verification for 20261105140000_atomic_billing_close.sql.
-- Run manually on approved staging after the migration, as postgres in the Dashboard SQL Editor.
-- Every fixture and assertion rolls back at the end. Requires an existing auth user; no user
-- accounts are created or modified. Configure SQL clients to stop on first error.
--
-- CONCURRENCY (separate approved staging exercise on a disposable collecting period whose
-- invoices are all paid except one invoice with balance > 0):
-- 1. Session A: begin; select public.record_bulk_payments(<actor>, '[{"invoice_id":"<inv>",
--    "amount":<balance>,"payment_date":"2026-10-20"}]'::jsonb); -- leave open
--    Session B: select public.close_billing_period_atomic(<period>, <actor>, gen_random_uuid(),
--    <revenue>, <profit>, <rate>, <accrual>); -- must block on the period lock.
--    Commit A. B must succeed (payment visible) without a deadlock error.
-- 2. Close first, then record_bulk_payments: the payment call must fail with
--    'period of invoice ... is closed'.
-- 3. Two sessions calling close_billing_period_atomic for the same period: one commits, the other
--    returns replayed = true; exactly one period.closed audit row and one monthly_accrual row exist.
-- 4. Re-run the contract checkout verification in this folder: it must still pass because checkout
--    already refuses closed periods (CHECKOUT_PERIOD_CLOSED) before it writes invoices or payments.
begin;

create function pg_temp.close_fixture(p_invoices integer, p_paid boolean default true) returns jsonb
language plpgsql as $$
declare
  b uuid := gen_random_uuid();
  period uuid := gen_random_uuid();
  actor uuid;
  r uuid; t uuid; c uuid; i uuid;
  ids uuid[] := array[]::uuid[];
  n integer;
begin
  select id into actor from auth.users order by created_at, id limit 1;
  if actor is null then raise exception 'Fixture requires an existing auth user'; end if;
  insert into public.buildings(id, name, address, code, slug)
    values(b, 'Atomic billing close verification', 'Staging fixture', 'verify-' || b::text, 'verify-' || b::text);
  insert into public.billing_periods(id, building_id, period_year, period_month, status, opened_by, issued_at)
    values(period, b, 2026, 10, 'collecting', actor, now());
  for n in 1..p_invoices loop
    r := gen_random_uuid(); t := gen_random_uuid(); c := gen_random_uuid(); i := gen_random_uuid();
    insert into public.rooms(id, building_id, room_number, code, slug)
      values(r, b, 'R' || n, 'verify-' || r::text, 'verify-' || r::text);
    insert into public.tenants(id, full_name, phone, code)
      values(t, 'Close tenant ' || n, '+999' || lpad((floor(random() * 100000000000))::bigint::text, 11, '0'), 'verify-' || t::text);
    insert into public.contracts(id, contract_code, building_id, room_id, tenant_id,
      start_date, end_date, monthly_rent, deposit, payment_due_day, occupant_count)
      values(c, 'verify-' || c::text, b, r, t, '2026-01-01', '2026-12-31', 1000000, 2000000, 5, 1);
    insert into public.invoices(id, billing_period_id, contract_id, room_id, tenant_id, status, invoice_code,
      subtotal_amount, total_amount, paid_amount, balance_amount, issued_at, paid_at)
      values(i, period, c, r, t, case when p_paid then 'paid' else 'issued' end, 'verify-' || i::text,
        1000000, 1000000, case when p_paid then 1000000 else 0 end, case when p_paid then 0 else 1000000 end,
        now(), case when p_paid then now() else null end);
    if p_paid then
      insert into public.invoice_payments(invoice_id, amount, paid_at, payment_method, recorded_by)
        values(i, 1000000, current_date, 'cash', actor);
    end if;
    ids := ids || i;
  end loop;
  return jsonb_build_object('building', b, 'period', period, 'actor', actor, 'invoices', to_jsonb(ids));
end $$;

create function pg_temp.expect_error(p_sql text, p_prefix text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_prefix || '%' then return; end if;
    raise exception 'Expected error starting with %, got % (%)', p_prefix, sqlerrm, sqlstate;
  end;
  raise exception 'Expected error starting with % but the statement succeeded', p_prefix;
end $$;

create function pg_temp.close_call(f jsonb, revenue numeric, accrual numeric, rate numeric default 10) returns jsonb
language sql as $$
  select public.close_billing_period_atomic((f->>'period')::uuid, (f->>'actor')::uuid, gen_random_uuid(),
    revenue, revenue, rate, accrual)
$$;

create function pg_temp.audit_count(f jsonb, p_action text) returns integer
language sql as $$
  select count(*)::integer from public.billing_audit_events
  where billing_period_id = (f->>'period')::uuid and action = p_action
$$;

create function pg_temp.accrual_rows(f jsonb) returns table(amount numeric, reserve_rate_percent numeric)
language sql as $$
  select tx.amount, tx.reserve_rate_percent
  from public.reserve_fund_transactions tx
  join public.reserve_funds fund on fund.id = tx.fund_id
  where fund.building_id = (f->>'building')::uuid and tx.source = 'monthly_accrual'
$$;

-- Scenario 1: close commits status, accrual and audit together.
do $$
declare f jsonb := pg_temp.close_fixture(2); r jsonb;
begin
  r := pg_temp.close_call(f, 2000000, 200000);
  if (r->>'replayed')::boolean then raise exception 'S1: first close must not be a replay'; end if;
  if r->>'accrual_status' <> 'recorded' then raise exception 'S1: accrual_status %', r->>'accrual_status'; end if;
  if (select status from public.billing_periods where id = (f->>'period')::uuid) <> 'closed' then
    raise exception 'S1: period not closed'; end if;
  if (select closed_at from public.billing_periods where id = (f->>'period')::uuid) is null then
    raise exception 'S1: closed_at not set'; end if;
  if (select count(*) from pg_temp.accrual_rows(f)) <> 1 or (select amount from pg_temp.accrual_rows(f)) <> 200000 then
    raise exception 'S1: expected one accrual of 200000'; end if;
  if pg_temp.audit_count(f, 'period.closed') <> 1 then raise exception 'S1: expected one period.closed audit'; end if;
end $$;

-- Scenario 2: outstanding invoices block the close and leave the period untouched.
do $$
declare f jsonb := pg_temp.close_fixture(1, false);
begin
  perform pg_temp.expect_error(
    format('select pg_temp.close_call(%L::jsonb, 1000000, 100000)', f), 'PERIOD_HAS_OUTSTANDING');
  if (select status from public.billing_periods where id = (f->>'period')::uuid) <> 'collecting' then
    raise exception 'S2: period changed'; end if;
  if (select count(*) from pg_temp.accrual_rows(f)) <> 0 then raise exception 'S2: accrual written'; end if;
end $$;

-- Scenario 3: a stale expected revenue is rejected and nothing changes.
do $$
declare f jsonb := pg_temp.close_fixture(1);
begin
  perform pg_temp.expect_error(
    format('select pg_temp.close_call(%L::jsonb, 999, 100000)', f), 'PERIOD_SNAPSHOT_STALE');
  if (select status from public.billing_periods where id = (f->>'period')::uuid) <> 'collecting' then
    raise exception 'S3: period changed'; end if;
end $$;

-- Scenario 4: a second close replays without duplicate audit or accrual.
do $$
declare f jsonb := pg_temp.close_fixture(1); r jsonb;
begin
  perform pg_temp.close_call(f, 1000000, 100000);
  r := pg_temp.close_call(f, 1000000, 100000);
  if not (r->>'replayed')::boolean then raise exception 'S4: second close must replay'; end if;
  if pg_temp.audit_count(f, 'period.closed') <> 1 then raise exception 'S4: duplicate audit'; end if;
  if (select count(*) from pg_temp.accrual_rows(f)) <> 1 then raise exception 'S4: duplicate accrual'; end if;
end $$;

-- Scenario 5: a closed period without a matching close audit is reported as inconsistent.
do $$
declare f jsonb := pg_temp.close_fixture(1);
begin
  update public.billing_periods set status = 'closed', closed_at = now() where id = (f->>'period')::uuid;
  perform pg_temp.expect_error(
    format('select pg_temp.close_call(%L::jsonb, 1000000, 100000)', f), 'PERIOD_CLOSED_INCONSISTENT');
end $$;

-- Scenario 5b: a period closed by the old TypeScript flow (camelCase audit) replays.
do $$
declare f jsonb := pg_temp.close_fixture(1); r jsonb; closed timestamptz := now();
begin
  update public.billing_periods set status = 'closed', closed_at = closed where id = (f->>'period')::uuid;
  insert into public.billing_audit_events(billing_period_id, actor_id, action, entity_type, entity_id, after_data)
    values((f->>'period')::uuid, (f->>'actor')::uuid, 'period.closed', 'billing_period', (f->>'period')::uuid,
      jsonb_build_object('status', 'closed', 'closedAt', closed));
  r := pg_temp.close_call(f, 1000000, 100000);
  if not (r->>'replayed')::boolean then raise exception 'S5b: legacy audit must replay'; end if;
end $$;

-- Scenario 6: a closed operations report keeps ownership of the accrual.
do $$
declare f jsonb := pg_temp.close_fixture(1); r jsonb;
begin
  insert into public.operations_report_periods(building_id, period_year, period_month, status, close_source, closed_at, closed_by)
    values((f->>'building')::uuid, 2026, 10, 'closed', 'manual', now(), (f->>'actor')::uuid);
  r := pg_temp.close_call(f, 1000000, 100000);
  if r->>'accrual_status' <> 'skipped_report_closed' then raise exception 'S6: accrual_status %', r->>'accrual_status'; end if;
  if (select count(*) from pg_temp.accrual_rows(f)) <> 0 then raise exception 'S6: accrual must not be written'; end if;
  if (select (metadata->>'accrual_status') from public.billing_audit_events
      where billing_period_id = (f->>'period')::uuid and action = 'period.closed') <> 'skipped_report_closed' then
    raise exception 'S6: audit must record the skip'; end if;
end $$;

-- Scenario 7: reopen keeps the accrual; closing again updates the same row and audits before/after.
do $$
declare f jsonb := pg_temp.close_fixture(1); r jsonb; meta jsonb; second_close_correlation uuid := gen_random_uuid();
begin
  perform pg_temp.expect_error(
    format('select public.reopen_billing_period_atomic(%L::uuid, %L::uuid, %L, gen_random_uuid())',
      f->>'period', f->>'actor', 'Reopen before close is invalid'), 'PERIOD_NOT_CLOSED');
  perform pg_temp.close_call(f, 1000000, 100000);
  perform pg_temp.expect_error(
    format('select public.reopen_billing_period_atomic(%L::uuid, %L::uuid, %L, gen_random_uuid())',
      f->>'period', f->>'actor', 'short'), 'PERIOD_REOPEN_REASON_INVALID');
  r := public.reopen_billing_period_atomic((f->>'period')::uuid, (f->>'actor')::uuid,
    'Correct a wrong payment amount', gen_random_uuid());
  if r->'period'->>'status' <> 'collecting' or r->'period'->>'closed_at' is not null then
    raise exception 'S7: reopen must return to collecting with closed_at null'; end if;
  if pg_temp.audit_count(f, 'period.reopened') <> 1 then raise exception 'S7: expected one reopen audit'; end if;
  if (select amount from pg_temp.accrual_rows(f)) <> 100000 then raise exception 'S7: reopen must keep the accrual'; end if;

  r := public.close_billing_period_atomic((f->>'period')::uuid, (f->>'actor')::uuid, second_close_correlation,
    1000000, 1000000, 15, 150000);
  if r->>'accrual_status' <> 'recorded' then raise exception 'S7: second close accrual_status %', r->>'accrual_status'; end if;
  if (select count(*) from pg_temp.accrual_rows(f)) <> 1 or (select amount from pg_temp.accrual_rows(f)) <> 150000 then
    raise exception 'S7: expected exactly one accrual of 150000'; end if;
  select metadata into meta from public.billing_audit_events
    where billing_period_id = (f->>'period')::uuid and action = 'period.closed'
      and correlation_id = second_close_correlation;
  -- now() is transaction-stable, so UUID ordering cannot identify the second close.
  if meta is null then raise exception 'S7: second close audit missing'; end if;
  if (meta->'accrual_before'->>'amount')::numeric <> 100000 or (meta->'accrual_after'->>'amount')::numeric <> 150000 then
    raise exception 'S7: audit must hold before/after accrual: %', meta; end if;
end $$;

-- Scenario 8: closed periods reject payments and money changes; other columns still update.
do $$
declare f jsonb := pg_temp.close_fixture(1, false); inv uuid;
begin
  inv := (f->'invoices'->>0)::uuid;
  update public.billing_periods set status = 'closed', closed_at = now() where id = (f->>'period')::uuid;
  perform pg_temp.expect_error(
    format('select public.record_bulk_payments(%L::uuid, %L::jsonb, gen_random_uuid())', f->>'actor',
      jsonb_build_array(jsonb_build_object('invoice_id', inv, 'amount', 1000, 'payment_date', '2026-10-20'))::text),
    'period of invoice');
  perform pg_temp.expect_error(
    format('insert into public.invoice_payments(invoice_id, amount, paid_at, recorded_by) values(%L::uuid, 1000, current_date, %L::uuid)',
      inv, f->>'actor'), 'PERIOD_CLOSED_LOCKED');
  perform pg_temp.expect_error(
    format('update public.invoices set total_amount = 5 where id = %L::uuid', inv), 'PERIOD_CLOSED_LOCKED');
  perform pg_temp.expect_error(
    format('update public.invoices set status = %L where id = %L::uuid', 'void', inv), 'PERIOD_CLOSED_LOCKED');
  update public.invoices set notes = 'non-money edit stays allowed' where id = inv;
end $$;

-- Scenario 9: bulk payments still work on an open period and move issued -> collecting.
do $$
declare f jsonb := pg_temp.close_fixture(1, false); inv uuid;
begin
  inv := (f->'invoices'->>0)::uuid;
  update public.billing_periods set status = 'issued' where id = (f->>'period')::uuid;
  perform public.record_bulk_payments((f->>'actor')::uuid,
    jsonb_build_array(jsonb_build_object('invoice_id', inv, 'amount', 1000000, 'payment_date', '2026-10-20')),
    gen_random_uuid());
  if (select status from public.billing_periods where id = (f->>'period')::uuid) <> 'collecting' then
    raise exception 'S9: period must move to collecting'; end if;
  if (select status from public.invoices where id = inv) <> 'paid' then raise exception 'S9: invoice must be paid'; end if;
end $$;

-- Scenario 10: anon and authenticated cannot execute the billing RPCs; service_role can.
do $$
declare rpc regprocedure;
begin
  foreach rpc in array array[
    'public.close_billing_period_atomic(uuid,uuid,uuid,numeric,numeric,numeric,numeric)'::regprocedure,
    'public.reopen_billing_period_atomic(uuid,uuid,text,uuid)'::regprocedure,
    'public.issue_period_invoices(uuid,uuid,timestamptz,uuid[],jsonb,uuid)'::regprocedure,
    'public.record_bulk_payments(uuid,jsonb,uuid)'::regprocedure,
    'public.issue_and_pay(uuid,uuid,uuid,date,integer,timestamptz,date,text,text,jsonb,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon', rpc, 'EXECUTE') or has_function_privilege('authenticated', rpc, 'EXECUTE') then
      raise exception 'S10: % is executable by anon or authenticated', rpc; end if;
    if not has_function_privilege('service_role', rpc, 'EXECUTE') then
      raise exception 'S10: % is not executable by service_role', rpc; end if;
  end loop;
end $$;

rollback;
