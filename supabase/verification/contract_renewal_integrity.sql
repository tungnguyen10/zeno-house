-- Read-only preflight, safe before migration deployment. Stop deployment when
-- contracts_with_multiple_successors > 0. Other findings need a reviewed repair plan.
select count(*) as successors_without_primary_occupant
from public.contracts c where c.previous_contract_id is not null
and not exists (select 1 from public.contract_occupants o where o.contract_id = c.id and o.role = 'primary');

select count(*) as renewed_contracts_with_open_occupants
from public.contracts c where c.status = 'renewed'
and exists (select 1 from public.contract_occupants o where o.contract_id = c.id and o.move_out_date is null);

select count(*) as renewed_contracts_with_positive_deposit_sources
from public.contracts c where c.status = 'renewed'
and exists (select 1 from public.contract_checkout_sources s where s.contract_id = c.id
  and public.contract_checkout_source_balance(s.id) > 0);

select count(*) as contracts_with_multiple_successors from (
  select previous_contract_id from public.contracts where previous_contract_id is not null
  group by previous_contract_id having count(*) > 1
) duplicates;

select count(*) as successors_with_overlapping_start_date
from public.contracts c join public.contracts previous on previous.id = c.previous_contract_id
where c.start_date <= previous.end_date;

-- NULL privileges mean the function is not deployed yet. After deployment expect
-- service_role=true, anon=false, authenticated=false (owners/postgres retain execution).
with rpc as (
  select to_regprocedure('public.renew_contract_atomic(uuid,text,date,numeric,text,uuid,uuid,uuid)') as oid
)
select oid is not null as renewal_rpc_deployed,
  has_function_privilege('service_role', oid, 'EXECUTE') as service_role_can_execute,
  has_function_privilege('anon', oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_can_execute
from rpc;
