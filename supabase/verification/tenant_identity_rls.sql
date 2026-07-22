-- Verifies primary and roommate tenant RLS against the linked Supabase project.
-- Requires one room, one unused billing-period slot, and two auth users without
-- tenant_user_links. An existing active contract is reused transactionally when
-- available; every fixture mutation is restored by the final rollback.
-- All fixture rows are created inside this transaction and rolled back.

begin;

create temporary table tenant_rls_test_context (
  primary_auth_user_id uuid not null,
  roommate_auth_user_id uuid not null,
  primary_tenant_id uuid not null,
  roommate_tenant_id uuid not null,
  other_tenant_id uuid not null,
  shared_contract_id uuid not null,
  other_contract_id uuid not null,
  billing_period_id uuid not null,
  shared_invoice_id uuid not null,
  other_invoice_id uuid not null
) on commit drop;

grant select on tenant_rls_test_context to authenticated;

create temporary table tenant_rls_test_fixture (
  room_id uuid not null,
  building_id uuid not null,
  shared_contract_id uuid not null,
  uses_existing_contract boolean not null,
  period_year integer not null,
  period_month integer not null
) on commit drop;

insert into tenant_rls_test_fixture
select
  fixture_room.id,
  fixture_room.building_id,
  coalesce(active_contract.id, gen_random_uuid()),
  active_contract.id is not null as uses_existing_contract,
  available_period.period_year,
  available_period.period_month
from public.rooms as fixture_room
left join lateral (
  select existing.id
  from public.contracts as existing
  where existing.room_id = fixture_room.id
    and existing.status = 'active'
  order by existing.created_at desc
  limit 1
) as active_contract on true
cross join lateral (
  select year_slot.period_year, month_slot.period_month
  from generate_series(2000, 2100) as year_slot(period_year)
  cross join generate_series(1, 12) as month_slot(period_month)
  where not exists (
    select 1
    from public.billing_periods as billing_period
    where billing_period.building_id = fixture_room.building_id
      and billing_period.period_year = year_slot.period_year
      and billing_period.period_month = month_slot.period_month
  )
  order by year_slot.period_year desc, month_slot.period_month desc
  limit 1
) as available_period
order by (active_contract.id is not null) desc, fixture_room.created_at
limit 1;

insert into tenant_rls_test_context
select
  candidates.ids[1],
  candidates.ids[2],
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  fixture.shared_contract_id,
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid()
from (
  select array_agg(users.id order by users.created_at) as ids
  from auth.users as users
  where not exists (
    select 1
    from public.tenant_user_links as link
    where link.auth_user_id = users.id
  )
) as candidates
cross join tenant_rls_test_fixture as fixture
where cardinality(candidates.ids) >= 2;

do $$
begin
  if not exists (select 1 from tenant_rls_test_context) then
    raise exception 'tenant RLS verification requires two unlinked auth users';
  end if;
  if not exists (select 1 from tenant_rls_test_fixture) then
    raise exception 'tenant RLS verification requires one room and an unused billing period';
  end if;
end
$$;

insert into public.tenants (id, code, full_name, phone)
select primary_tenant_id, 'RLS-PRIMARY-' || left(primary_tenant_id::text, 8), 'RLS Primary Tenant', 'rls-primary-' || left(primary_tenant_id::text, 8)
from tenant_rls_test_context
union all
select roommate_tenant_id, 'RLS-ROOMMATE-' || left(roommate_tenant_id::text, 8), 'RLS Roommate', 'rls-roommate-' || left(roommate_tenant_id::text, 8)
from tenant_rls_test_context
union all
select other_tenant_id, 'RLS-OTHER-' || left(other_tenant_id::text, 8), 'RLS Other Tenant', 'rls-other-' || left(other_tenant_id::text, 8)
from tenant_rls_test_context;

insert into public.tenant_user_links (auth_user_id, tenant_id, status)
select primary_auth_user_id, primary_tenant_id, 'active'
from tenant_rls_test_context
union all
select roommate_auth_user_id, roommate_tenant_id, 'active'
from tenant_rls_test_context;

update public.contracts as shared_contract
set
  tenant_id = context.primary_tenant_id,
  start_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 30,
  end_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture
where shared_contract.id = context.shared_contract_id
  and fixture.uses_existing_contract;

insert into public.contracts (
  id, contract_code, building_id, room_id, tenant_id,
  start_date, end_date, monthly_rent, status
)
select
  context.shared_contract_id,
  'RLS-SHARED-' || left(context.shared_contract_id::text, 8),
  fixture.building_id,
  fixture.room_id,
  context.primary_tenant_id,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date - 30,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30,
  1,
  'active'
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture
where not fixture.uses_existing_contract
union all
select
  context.other_contract_id,
  'RLS-OTHER-' || left(context.other_contract_id::text, 8),
  fixture.building_id,
  fixture.room_id,
  context.other_tenant_id,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date - 30,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30,
  1,
  'terminated'
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture;

insert into public.contract_occupants (
  contract_id, tenant_id, role, move_in_date, move_out_date
)
select shared_contract_id, roommate_tenant_id, 'roommate', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, null
from tenant_rls_test_context;

insert into public.billing_periods (
  id, building_id, period_year, period_month, status
)
select
  context.billing_period_id,
  fixture.building_id,
  fixture.period_year,
  fixture.period_month,
  'draft'
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture;

insert into public.invoices (
  id, invoice_code, billing_period_id, contract_id, room_id, tenant_id, status
)
select
  context.shared_invoice_id,
  'RLS-SHARED-' || left(context.shared_contract_id::text, 8),
  context.billing_period_id,
  context.shared_contract_id,
  fixture.room_id,
  context.primary_tenant_id,
  'draft'
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture
union all
select
  context.other_invoice_id,
  'RLS-OTHER-' || left(context.other_contract_id::text, 8),
  context.billing_period_id,
  context.other_contract_id,
  fixture.room_id,
  context.other_tenant_id,
  'draft'
from tenant_rls_test_context as context
cross join tenant_rls_test_fixture as fixture;

-- Primary tenant retains direct profile, contract, and invoice access.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', primary_auth_user_id,
    'app_metadata', jsonb_build_object('role', 'tenant')
  )::text,
  true
)
from tenant_rls_test_context;

set local role authenticated;

do $$
begin
  if (select count(*) from public.tenants where id in (
    select primary_tenant_id from tenant_rls_test_context
    union all
    select roommate_tenant_id from tenant_rls_test_context
  )) <> 1
  or (select count(*) from public.contracts where id = (
    select shared_contract_id from tenant_rls_test_context
  )) <> 1
  or (select count(*) from public.invoices where id = (
    select shared_invoice_id from tenant_rls_test_context
  )) <> 1
  then
    raise exception 'primary tenant RLS verification failed';
  end if;
end
$$;

reset role;

-- Active roommate sees only their profile/occupancy and the shared contract/invoice.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', roommate_auth_user_id,
    'app_metadata', jsonb_build_object('role', 'tenant')
  )::text,
  true
)
from tenant_rls_test_context;

set local role authenticated;

do $$
begin
  if (select count(*) from public.tenants where id in (
    select primary_tenant_id from tenant_rls_test_context
    union all
    select roommate_tenant_id from tenant_rls_test_context
  )) <> 1
  or (select count(*) from public.contract_occupants where tenant_id = (
    select roommate_tenant_id from tenant_rls_test_context
  )) <> 1
  or (select count(*) from public.contracts where id = (
    select shared_contract_id from tenant_rls_test_context
  )) <> 1
  or exists (
    select 1 from public.contracts
    where id = (select other_contract_id from tenant_rls_test_context)
  )
  or (select count(*) from public.invoices where id = (
    select shared_invoice_id from tenant_rls_test_context
  )) <> 1
  or exists (
    select 1 from public.invoices
    where id = (select other_invoice_id from tenant_rls_test_context)
  )
  then
    raise exception 'active roommate RLS verification failed';
  end if;
end
$$;

reset role;

-- A future move-in date grants no shared access.
update public.contract_occupants
set move_in_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1
where tenant_id = (select roommate_tenant_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.contracts
    where id = (select shared_contract_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.invoices
    where id = (select shared_invoice_id from tenant_rls_test_context)
  )
  then
    raise exception 'future roommate move-in RLS verification failed';
  end if;
end
$$;

reset role;

update public.contract_occupants
set move_in_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1
where tenant_id = (select roommate_tenant_id from tenant_rls_test_context);

-- Expired and terminated contracts grant no shared access.
update public.contracts
set end_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1
where id = (select shared_contract_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.contracts
    where id = (select shared_contract_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.invoices
    where id = (select shared_invoice_id from tenant_rls_test_context)
  )
  then
    raise exception 'expired roommate contract RLS verification failed';
  end if;
end
$$;

reset role;

update public.contracts
set
  end_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30,
  status = 'terminated'
where id = (select shared_contract_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.contracts
    where id = (select shared_contract_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.invoices
    where id = (select shared_invoice_id from tenant_rls_test_context)
  )
  then
    raise exception 'terminated roommate contract RLS verification failed';
  end if;
end
$$;

reset role;

update public.contracts
set status = 'active'
where id = (select shared_contract_id from tenant_rls_test_context);

-- Recording move-out removes shared contract/invoice access immediately.
update public.contract_occupants
set move_out_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
where tenant_id = (select roommate_tenant_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.contracts
    where id = (select shared_contract_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.invoices
    where id = (select shared_invoice_id from tenant_rls_test_context)
  )
  or not exists (
    select 1 from public.tenants
    where id = (select roommate_tenant_id from tenant_rls_test_context)
  )
  then
    raise exception 'moved-out roommate RLS verification failed';
  end if;
end
$$;

reset role;

-- Disabled account link removes both personal and shared direct access.
update public.contract_occupants
set move_out_date = null
where tenant_id = (select roommate_tenant_id from tenant_rls_test_context);

update public.tenant_user_links
set status = 'disabled'
where auth_user_id = (select roommate_auth_user_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.tenants
    where id = (select roommate_tenant_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.contract_occupants
    where tenant_id = (select roommate_tenant_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.contracts
    where id = (select shared_contract_id from tenant_rls_test_context)
  )
  or exists (
    select 1 from public.invoices
    where id = (select shared_invoice_id from tenant_rls_test_context)
  )
  then
    raise exception 'disabled roommate RLS verification failed';
  end if;
end
$$;

reset role;
rollback;

select 'tenant identity and roommate RLS verification passed' as result;
