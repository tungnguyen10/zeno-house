-- Verifies tenant self-read RLS against the linked Supabase project.
-- All fixture rows are created inside this transaction and rolled back.

begin;

create temporary table tenant_rls_test_context (
  auth_user_id uuid not null,
  own_tenant_id uuid not null,
  other_tenant_id uuid not null,
  own_contract_id uuid not null,
  other_contract_id uuid not null,
  billing_period_id uuid not null
) on commit drop;

grant select on tenant_rls_test_context to authenticated;

insert into tenant_rls_test_context
select
  users.id,
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid()
from auth.users as users
order by users.created_at
limit 1;

do $$
begin
  if not exists (select 1 from tenant_rls_test_context) then
    raise exception 'tenant RLS verification requires one auth user';
  end if;
end
$$;

insert into public.tenants (id, code, full_name, phone)
select own_tenant_id, 'RLS-OWN-' || left(own_tenant_id::text, 8), 'RLS Own Tenant', 'rls-own'
from tenant_rls_test_context
union all
select other_tenant_id, 'RLS-OTHER-' || left(other_tenant_id::text, 8), 'RLS Other Tenant', 'rls-other'
from tenant_rls_test_context;

insert into public.tenant_user_links (auth_user_id, tenant_id, status)
select auth_user_id, own_tenant_id, 'active'
from tenant_rls_test_context;

insert into public.contracts (
  id,
  contract_code,
  building_id,
  room_id,
  tenant_id,
  start_date,
  end_date,
  monthly_rent,
  status
)
select
  context.own_contract_id,
  'RLS-OWN-' || left(context.own_contract_id::text, 8),
  room.building_id,
  room.id,
  context.own_tenant_id,
  date '2098-01-01',
  date '2098-12-31',
  1,
  'terminated'
from tenant_rls_test_context as context
cross join lateral (select id, building_id from public.rooms order by created_at limit 1) as room
union all
select
  context.other_contract_id,
  'RLS-OTHER-' || left(context.other_contract_id::text, 8),
  room.building_id,
  room.id,
  context.other_tenant_id,
  date '2098-01-01',
  date '2098-12-31',
  1,
  'terminated'
from tenant_rls_test_context as context
cross join lateral (select id, building_id from public.rooms order by created_at limit 1) as room;

insert into public.billing_periods (
  id,
  building_id,
  period_year,
  period_month,
  status
)
select
  context.billing_period_id,
  room.building_id,
  2099,
  12,
  'draft'
from tenant_rls_test_context as context
cross join lateral (select building_id from public.rooms order by created_at limit 1) as room;

insert into public.invoices (
  invoice_code,
  billing_period_id,
  contract_id,
  room_id,
  tenant_id,
  status
)
select
  'RLS-OWN-' || left(context.own_contract_id::text, 8),
  context.billing_period_id,
  context.own_contract_id,
  room.id,
  context.own_tenant_id,
  'draft'
from tenant_rls_test_context as context
cross join lateral (select id from public.rooms order by created_at limit 1) as room
union all
select
  'RLS-OTHER-' || left(context.other_contract_id::text, 8),
  context.billing_period_id,
  context.other_contract_id,
  room.id,
  context.other_tenant_id,
  'draft'
from tenant_rls_test_context as context
cross join lateral (select id from public.rooms order by created_at limit 1) as room;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', auth_user_id,
    'app_metadata', jsonb_build_object('role', 'tenant')
  )::text,
  true
)
from tenant_rls_test_context;

set local role authenticated;

do $$
declare
  visible_own_tenants integer;
  visible_other_tenants integer;
  visible_own_contracts integer;
  visible_other_contracts integer;
  visible_own_invoices integer;
  visible_other_invoices integer;
begin
  select count(*) into visible_own_tenants
  from public.tenants
  where id = (select own_tenant_id from tenant_rls_test_context);

  select count(*) into visible_other_tenants
  from public.tenants
  where id = (select other_tenant_id from tenant_rls_test_context);

  select count(*) into visible_own_contracts
  from public.contracts
  where id = (select own_contract_id from tenant_rls_test_context);

  select count(*) into visible_other_contracts
  from public.contracts
  where id = (select other_contract_id from tenant_rls_test_context);

  select count(*) into visible_own_invoices
  from public.invoices
  where tenant_id = (select own_tenant_id from tenant_rls_test_context);

  select count(*) into visible_other_invoices
  from public.invoices
  where tenant_id = (select other_tenant_id from tenant_rls_test_context);

  if visible_own_tenants <> 1
    or visible_other_tenants <> 0
    or visible_own_contracts <> 1
    or visible_other_contracts <> 0
    or visible_own_invoices <> 1
    or visible_other_invoices <> 0
  then
    raise exception 'active tenant RLS verification failed';
  end if;
end
$$;

reset role;

update public.tenant_user_links
set status = 'disabled'
where auth_user_id = (select auth_user_id from tenant_rls_test_context);

set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.tenants
    where id = (select own_tenant_id from tenant_rls_test_context)
  ) or exists (
    select 1 from public.contracts
    where id = (select own_contract_id from tenant_rls_test_context)
  ) or exists (
    select 1 from public.invoices
    where tenant_id = (select own_tenant_id from tenant_rls_test_context)
  ) then
    raise exception 'disabled tenant RLS verification failed';
  end if;
end
$$;

reset role;
rollback;

select 'tenant identity RLS verification passed' as result;
