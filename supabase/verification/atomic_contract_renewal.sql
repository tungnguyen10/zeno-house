-- Run manually on approved staging after migration, as postgres in Dashboard SQL Editor.
-- All fixtures and the fault-injection trigger roll back. Requires an existing auth user;
-- no user accounts are created or modified. Configure SQL clients to stop on first error.
--
-- CONCURRENCY (separate approved staging exercise; do not use rolled-back fixture IDs):
-- Prepare a disposable active contract with a primary occupant. In session A:
-- begin; select public.renew_contract_atomic(<contract>, 'new_contract', <end date>,
--   <rent>, 'concurrency', <actor>, <operation A>, <correlation>); -- leave open
-- Session B: same call with operation B; it must block until A commits.
-- Commit A. B must fail CONTRACT_NOT_ACTIVE or CONTRACT_ALREADY_RENEWED.
-- Repeat using operation A in both sessions: B must return replayed=true.
-- Check one successor, one renewal and one renewal audit. Clean up only via an approved plan.
-- Also exercise concurrent receipt INSERT versus renewal: receipt-first must transfer its source;
-- renewal-first must reject the receipt with CONTRACT_RENEWED_RECEIPT_LOCKED.
begin;

-- Helpers live only in this transaction/session. Every scenario gets a separate fixture.
create function pg_temp.renewal_fixture(roommates integer default 0) returns jsonb
language plpgsql as $$
declare b uuid := gen_random_uuid(); r uuid := gen_random_uuid(); t uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); actor uuid; payment uuid; catalog uuid; i integer;
begin
  select id into actor from auth.users order by created_at, id limit 1;
  if actor is null then raise exception 'Fixture requires an existing auth user'; end if;
  insert into public.buildings(id, name, address, code, slug)
    values(b, 'Atomic renewal verification', 'Staging fixture', 'verify-' || b::text, 'verify-' || b::text);
  insert into public.rooms(id, building_id, room_number, code, slug) values(r, b, '101', 'verify-' || r::text, 'verify-' || r::text);
  insert into public.tenants(id, full_name, phone, code) values(t, 'Renewal primary', '+999' || lpad((floor(random() * 100000000000))::bigint::text, 11, '0'), 'verify-' || t::text);
  insert into public.contracts(id, contract_code, building_id, room_id, tenant_id,
    start_date, end_date, monthly_rent, deposit, payment_due_day, occupant_count)
    values(c, 'verify-' || c::text, b, r, t, '2026-01-01', '2026-12-31', 3000000, 6000000, 5, roommates + 1);
  insert into public.contract_occupants(contract_id, tenant_id, role, billing_counted, move_in_date)
    values(c, t, 'primary', true, '2026-01-01');
  for i in 1..roommates loop
    t := gen_random_uuid();
    insert into public.tenants(id, full_name, phone, code) values(t, 'Renewal roommate ' || i, '+999' || lpad((floor(random() * 100000000000))::bigint::text, 11, '0'), 'verify-' || t::text);
    insert into public.contract_occupants(contract_id, tenant_id, role, billing_counted, move_in_date)
      values(c, t, 'roommate', i % 2 = 0, '2026-02-01');
  end loop;
  for i in 1..2 loop
    insert into public.service_catalog(code, name, pricing_type, building_id)
      values('verify-' || gen_random_uuid()::text, 'Fixture service ' || i, 'fixed_per_room', b)
      returning id into catalog;
    insert into public.contract_services(contract_id, catalog_id, amount, quantity, is_enabled, notes)
      values(c, catalog, 20000 * i, i, i = 1, 'Preserve service settings');
  end loop;
  insert into public.contract_payments(contract_id, payment_type, amount, paid_at)
    values(c, 'deposit', 6000000, '2026-01-01') returning id into payment;
  return jsonb_build_object('contract', c, 'building', b, 'actor', actor, 'payment', payment);
end $$;

create function pg_temp.renewal_call(f jsonb, mode text, operation uuid default gen_random_uuid(),
  correlation uuid default gen_random_uuid(), rent numeric default 3500000) returns jsonb
language sql as $$
  select public.renew_contract_atomic((f->>'contract')::uuid, mode, '2027-12-31', rent,
    'Staging verification', (f->>'actor')::uuid, operation, correlation)
$$;

-- extend: terms, history, amendment cancellation and correlated audit are atomic.
do $$
declare f jsonb := pg_temp.renewal_fixture(); result jsonb; amendment uuid;
  correlation uuid := gen_random_uuid(); c uuid := (f->>'contract')::uuid;
begin
  insert into public.contract_amendments(contract_id, sequence_no, title, public_content,
    effective_date, status, changes, before_terms, after_terms, published_at)
    values(c, 1, 'Fixture amendment', 'Scheduled terms', '2026-12-01', 'scheduled',
      '{"monthly_rent":4000000}', '{"monthly_rent":3000000}', '{"monthly_rent":4000000}', now())
    returning id into amendment;
  result := pg_temp.renewal_call(f, 'extend', gen_random_uuid(), correlation);
  if not exists(select 1 from public.contracts where id=c and status='active'
    and end_date='2027-12-31' and original_end_date='2026-12-31' and monthly_rent=3500000 and renewal_count=1)
    or result->'new_contract' <> 'null'::jsonb
    or (select count(*) from public.contract_renewals where contract_id=c) <> 1
    or not exists(select 1 from public.contract_amendments where id=amendment and status='cancelled'
      and cancelled_by=(f->>'actor')::uuid)
    or (select count(*) from public.audit_events where correlation_id=correlation
      and action in ('contract.renewed','contract.amendment.cancelled')) <> 2 then
    raise exception 'FAIL: extend terms/history/amendment/audit';
  end if;
end $$;

-- new_contract: zero, one and multiple roommates; preserve primary and billing flags,
-- disabled services, source IDs/balances, receipt origin and inclusive date boundaries.
do $$
declare n integer; f jsonb; result jsonb; c uuid; successor uuid; held numeric;
begin
  foreach n in array array[0,1,3] loop
    f := pg_temp.renewal_fixture(n); c := (f->>'contract')::uuid;
    held := (public.contract_checkout_preview(c)->>'depositHeld')::numeric;
    result := pg_temp.renewal_call(f, 'new_contract'); successor := (result->'new_contract'->>'id')::uuid;
    if successor is null or not exists(select 1 from public.contracts where id=successor
      and previous_contract_id=c and status='active' and start_date='2027-01-01' and monthly_rent=3500000
      and payment_due_day=5 and deposit=6000000 and renewal_count=1)
      or not exists(select 1 from public.contracts where id=c and status='renewed')
      or (select count(*) from public.contract_occupants where contract_id=successor) <> n+1
      or exists(select 1 from public.contract_occupants where contract_id=c and move_out_date is distinct from date '2026-12-31')
      or exists(select tenant_id, role, billing_counted from public.contract_occupants where contract_id=c
        except select tenant_id, role, billing_counted from public.contract_occupants where contract_id=successor and move_in_date='2027-01-01')
      or (select count(*) from public.contract_services where contract_id=successor) <> 2
      or exists(select catalog_id, amount, quantity, is_enabled, notes from public.contract_services where contract_id=c
        except select catalog_id, amount, quantity, is_enabled, notes from public.contract_services where contract_id=successor)
      or (public.contract_checkout_preview(successor)->>'depositHeld')::numeric is distinct from held
      or not exists(select 1 from public.contract_checkout_sources where contract_id=successor and payment_id=(f->>'payment')::uuid)
      or not exists(select 1 from jsonb_array_elements(public.contract_checkout_get(successor)->'sources') x
        where x->>'originContractId'=c::text and x->>'originContractCode'='verify-' || c::text)
      or not exists(select 1 from public.contract_payments where id=(f->>'payment')::uuid and contract_id=c) then
      raise exception 'FAIL: new_contract roommates=% transfer/date/settings', n;
    end if;
  end loop;
end $$;

-- Replay and operation mismatch: no additional writes, including audit.
do $$
declare f jsonb := pg_temp.renewal_fixture(); op uuid := gen_random_uuid(); first_result jsonb;
  replay jsonb; audits bigint; renewals bigint; contracts bigint;
begin
  first_result := pg_temp.renewal_call(f, 'new_contract', op);
  select count(*) into audits from public.audit_events;
  select count(*) into renewals from public.contract_renewals;
  select count(*) into contracts from public.contracts;
  replay := pg_temp.renewal_call(f, 'new_contract', op);
  if replay->>'replayed' is distinct from 'true' or replay->'renewal' is distinct from first_result->'renewal'
    or (select count(*) from public.audit_events) <> audits
    or (select count(*) from public.contract_renewals) <> renewals
    or (select count(*) from public.contracts) <> contracts then raise exception 'FAIL: replay duplicated writes'; end if;
  begin
    perform pg_temp.renewal_call(f, 'new_contract', op, gen_random_uuid(), 3600000);
    raise exception 'FAIL: mismatch accepted';
  exception when unique_violation then
    if sqlerrm <> 'RENEWAL_OPERATION_MISMATCH' then raise; end if;
  end;
end $$;

-- A checkout at any stage blocks renewal without mutation.
do $$
declare f jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid; snapshot jsonb;
begin
  select to_jsonb(ct) into snapshot from public.contracts ct where id=c;
  insert into public.contract_checkouts(contract_id, building_id, actual_return_date, reason)
    values(c, (f->>'building')::uuid, '2026-12-31', 'Fixture checkout');
  begin
    perform pg_temp.renewal_call(f, 'new_contract'); raise exception 'FAIL: checkout accepted';
  exception when check_violation then
    if sqlerrm <> 'CONTRACT_CHECKOUT_IN_PROGRESS' then raise; end if;
  end;
  if (select to_jsonb(ct) from public.contracts ct where id=c) is distinct from snapshot
    or exists(select 1 from public.contract_renewals where contract_id=c) then raise exception 'FAIL: checkout mutated contract'; end if;
end $$;

-- Inject a genuine unique violation halfway through the successor service clone.
-- The original service has the same catalog_id; a BEFORE INSERT trigger adds the
-- successor's duplicate so its incoming row violates UNIQUE(contract_id,catalog_id).
create function pg_temp.fail_renewal_clone() returns trigger language plpgsql as $$
begin
  if exists(select 1 from public.contracts where id=new.contract_id and previous_contract_id::text=current_setting('zeno.verify_renewal_contract',true))
    and pg_trigger_depth()=1 then
    insert into public.contract_services(contract_id,catalog_id,amount) values(new.contract_id,new.catalog_id,1);
  end if;
  return new;
end $$;
create trigger verify_renewal_clone_failure before insert on public.contract_services
  for each row execute function pg_temp.fail_renewal_clone();
do $$
declare f jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid;
  before_contract jsonb; before_occupants jsonb; before_sources jsonb; audits bigint; failed_constraint text;
begin
  select to_jsonb(ct) into before_contract from public.contracts ct where id=c;
  select jsonb_agg(to_jsonb(o) order by id) into before_occupants from public.contract_occupants o where contract_id=c;
  select jsonb_agg(to_jsonb(s) order by id) into before_sources from public.contract_checkout_sources s where contract_id=c;
  select count(*) into audits from public.audit_events;
  perform set_config('zeno.verify_renewal_contract',c::text,true);
  begin
    perform pg_temp.renewal_call(f, 'new_contract'); raise exception 'FAIL: forced clone failure did not fire';
  exception when unique_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint <> 'contract_services_contract_id_catalog_id_key' then raise; end if;
  end;
  if (select to_jsonb(ct) from public.contracts ct where id=c) is distinct from before_contract
    or (select jsonb_agg(to_jsonb(o) order by id) from public.contract_occupants o where contract_id=c) is distinct from before_occupants
    or (select jsonb_agg(to_jsonb(s) order by id) from public.contract_checkout_sources s where contract_id=c) is distinct from before_sources
    or exists(select 1 from public.contracts where previous_contract_id=c)
    or exists(select 1 from public.contract_renewals where contract_id=c)
    or (select count(*) from public.audit_events) <> audits then raise exception 'FAIL: forced clone failure did not roll back'; end if;
end $$;
drop trigger verify_renewal_clone_failure on public.contract_services;

-- Frozen receipts: INSERT, UPDATE, DELETE and changing the receipt's contract are blocked.
-- Active contract receipts still support ordinary insert/update/delete.
do $$
declare f jsonb := pg_temp.renewal_fixture(); active_fixture jsonb := pg_temp.renewal_fixture();
  c uuid := (f->>'contract')::uuid; receipt uuid := (f->>'payment')::uuid; i integer; p uuid;
begin
  perform pg_temp.renewal_call(f, 'new_contract');
  for i in 1..4 loop
    begin
      if i=1 then insert into public.contract_payments(contract_id,payment_type,amount,paid_at) values(c,'other',1,current_date);
      elsif i=2 then update public.contract_payments set amount=amount+1 where id=receipt;
      elsif i=3 then delete from public.contract_payments where id=receipt;
      else update public.contract_payments set contract_id=(active_fixture->>'contract')::uuid where id=receipt; end if;
      raise exception 'FAIL: renewed receipt mutation % accepted', i;
    exception when check_violation then
      if sqlerrm <> 'CONTRACT_RENEWED_RECEIPT_LOCKED' then raise; end if;
    end;
  end loop;
  insert into public.contract_payments(contract_id,payment_type,amount,paid_at)
    values((active_fixture->>'contract')::uuid,'other',1,current_date) returning id into p;
  update public.contract_payments set amount=2 where id=p;
  delete from public.contract_payments where id=p;
end $$;

-- Ancestor prepaid_rent receipt may be credited to a returned successor; its new
-- source belongs to successor while receipt and origin remain on the renewed ancestor.
do $$
declare f jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid; payment uuid; successor uuid; result jsonb;
begin
  insert into public.contract_payments(contract_id,payment_type,amount,paid_at)
    values(c,'prepaid_rent',1000000,'2026-01-01') returning id into payment;
  result := pg_temp.renewal_call(f,'new_contract'); successor := (result->'new_contract'->>'id')::uuid;
  -- Direct fixture insert of the returned checkout avoids unrelated meter/billing prerequisites.
  insert into public.contract_checkouts(contract_id,building_id,actual_return_date,reason,status,financial_mode)
    values(successor,(f->>'building')::uuid,'2027-12-31','Fixture credit','returned','settlement');
  perform public.contract_checkout_credit(successor,(f->>'actor')::uuid,payment,500000,'Ancestor prepaid rent',gen_random_uuid());
  if not exists(select 1 from public.contract_checkout_sources where payment_id=payment and contract_id=successor and approved_amount=500000)
    or (public.contract_checkout_get(successor)->>'creditHeld')::numeric <> 500000 then raise exception 'FAIL: ancestor credit'; end if;
end $$;

-- A contract without occupant rows (legacy data) renews with its tenant as primary occupant.
do $$
declare f jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid; result jsonb; successor uuid;
begin
  delete from public.contract_occupants where contract_id=c;
  result := pg_temp.renewal_call(f,'new_contract'); successor := (result->'new_contract'->>'id')::uuid;
  if (select count(*) from public.contract_occupants where contract_id=successor) <> 1
    or not exists(select 1 from public.contract_occupants o join public.contracts ct on ct.id=o.contract_id
      where o.contract_id=successor and o.tenant_id=ct.tenant_id and o.role='primary'
        and o.billing_counted and o.move_in_date='2027-01-01' and o.move_out_date is null)
    or exists(select 1 from public.contract_occupants where contract_id=c) then
    raise exception 'FAIL: legacy contract without occupants did not get a primary occupant';
  end if;
end $$;

-- No usable occupancy (tenant already lives on another contract) means no successor and no partial mutation.
do $$
declare f jsonb := pg_temp.renewal_fixture(); other jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid;
begin
  delete from public.contract_occupants where contract_id=c;
  insert into public.contract_occupants(contract_id,tenant_id,role,billing_counted,move_in_date)
    select (other->>'contract')::uuid, tenant_id, 'roommate', true, '2026-03-01' from public.contracts where id=c;
  begin
    perform pg_temp.renewal_call(f,'new_contract'); raise exception 'FAIL: missing occupants accepted';
  exception when check_violation then
    if sqlerrm <> 'RENEWAL_OCCUPANTS_MISSING' then raise; end if;
  end;
  if not exists(select 1 from public.contracts where id=c and status='active')
    or exists(select 1 from public.contracts where previous_contract_id=c) then raise exception 'FAIL: missing occupants mutated contract'; end if;
end $$;

-- Historical partially refunded and exhausted sources: validate their real refund
-- ledger while still on the statement's contract, then carry them into the active
-- fixture to model sources inherited before this renewal. Do not disable guards.
do $$
declare historical jsonb := pg_temp.renewal_fixture(); f jsonb := pg_temp.renewal_fixture();
  h_contract uuid := (historical->>'contract')::uuid; c uuid := (f->>'contract')::uuid;
  checkout uuid; statement uuid; partial_source uuid; zero_source uuid; payment uuid;
  result jsonb; successor uuid;
begin
  delete from public.contract_payments where id=(f->>'payment')::uuid;
  select id into partial_source from public.contract_checkout_sources where contract_id=h_contract;
  insert into public.contract_payments(contract_id,payment_type,amount,paid_at)
    values(h_contract,'deposit',6000000,'2026-01-01') returning id into payment;
  select id into zero_source from public.contract_checkout_sources where payment_id=payment;
  insert into public.contract_checkouts(contract_id,building_id,actual_return_date,reason,status,financial_mode)
    values(h_contract,(historical->>'building')::uuid,'2026-12-31','Historical ledger fixture','returned','settlement')
    returning id into checkout;
  insert into public.contract_checkout_statements(checkout_id,operation_id,snapshot_hash,preview,code)
    values(checkout,gen_random_uuid(),'fixture','{}','verify-' || gen_random_uuid()::text) returning id into statement;
  insert into public.contract_checkout_refunds(statement_id,source_id,operation_id,amount,paid_at,payment_method)
    values(statement,partial_source,gen_random_uuid(),2000000,'2026-12-31','cash'),
      (statement,zero_source,gen_random_uuid(),6000000,'2026-12-31','cash');
  set constraints all immediate;
  update public.contract_checkout_sources set contract_id=c where id in (partial_source,zero_source);
  if (public.contract_checkout_preview(c)->>'depositHeld')::numeric <> 4000000 then
    raise exception 'FAIL: partially refunded fixture balance';
  end if;
  result := pg_temp.renewal_call(f,'new_contract'); successor := (result->'new_contract'->>'id')::uuid;
  if not exists(select 1 from public.contract_checkout_sources where id=partial_source and contract_id=successor)
    or public.contract_checkout_source_balance(partial_source) <> 4000000
    or not exists(select 1 from public.contract_checkout_sources where id=zero_source and contract_id=c)
    or public.contract_checkout_source_balance(zero_source) <> 0
    or (public.contract_checkout_preview(successor)->>'depositHeld')::numeric <> 4000000
    or jsonb_array_length(result->'transferred_source_ids') <> 1
    or not (result->'transferred_source_ids' @> jsonb_build_array(partial_source)) then
    raise exception 'FAIL: partially refunded or zero-balance source transfer';
  end if;
end $$;

-- Boundary and malformed inputs must raise the domain error before any writes.
do $$
declare f jsonb := pg_temp.renewal_fixture(); c uuid := (f->>'contract')::uuid;
  actor uuid := (f->>'actor')::uuid; snapshot jsonb; i integer;
begin
  select to_jsonb(ct) into snapshot from public.contracts ct where id=c;
  for i in 1..8 loop
    begin
      perform public.renew_contract_atomic(c,
        case when i=1 then null when i=2 then 'invalid' when i=3 then 'extend' else 'new_contract' end,
        case when i=3 then date '2026-12-31' when i=4 then date '2027-01-01'
          when i=5 then null else date '2027-12-31' end,
        case when i=6 then null when i=7 then -1 when i=8 then 1.5 else 3500000 end,
        'Invalid input fixture',actor,gen_random_uuid(),gen_random_uuid());
      raise exception 'FAIL: invalid renewal input % accepted', i;
    exception when datetime_field_overflow then
      if sqlerrm <> 'RENEWAL_END_DATE_INVALID' then raise; end if;
    end;
  end loop;
  if (select to_jsonb(ct) from public.contracts ct where id=c) is distinct from snapshot
    or exists(select 1 from public.contract_renewals where contract_id=c) then raise exception 'FAIL: invalid inputs wrote data'; end if;
  begin
    perform public.renew_contract_atomic(gen_random_uuid(),'extend','2027-12-31',null,
      'Missing contract',actor,gen_random_uuid(),gen_random_uuid());
    raise exception 'FAIL: missing contract accepted';
  exception when no_data_found then
    if sqlerrm <> 'CONTRACT_NOT_FOUND' then raise; end if;
  end;
  perform pg_temp.renewal_call(f,'new_contract');
  begin
    perform pg_temp.renewal_call(f,'new_contract'); raise exception 'FAIL: nonactive contract accepted';
  exception when check_violation then
    if sqlerrm <> 'CONTRACT_NOT_ACTIVE' then raise; end if;
  end;
end $$;

set constraints all immediate;
rollback;
