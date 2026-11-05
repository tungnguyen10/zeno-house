-- Repairs legacy contract renewal chains created before renew_contract_atomic existed.
-- Run in the Supabase Dashboard SQL Editor only after reviewing the output of
-- supabase/verification/contract_renewal_integrity.sql.
--
-- For every `renewed` contract that has a later `active` successor in its chain, the script:
--   1. closes open occupancies on the renewed contract at that contract's own end_date;
--   2. re-creates each of those occupancies on the latest active successor when the tenant
--      has no other open occupancy;
--   3. moves checkout sources with a positive balance to the latest active successor;
--   4. writes one audit event per repaired contract, all sharing one correlation_id.
-- It never changes start_date or billing data.
--
-- The script ends with ROLLBACK so the first run is a dry run. Review the NOTICE lines and the
-- reconciliation results, then switch the final ROLLBACK to COMMIT and run it again.

begin;

create temporary table renewal_repair_targets on commit drop as
with recursive chain as (
  select r.id as renewed_id, c.id as current_id, c.status
  from public.contracts r
  join public.contracts c on c.previous_contract_id = r.id
  where r.status = 'renewed'
  union all
  select chain.renewed_id, c.id, c.status
  from chain
  join public.contracts c on c.previous_contract_id = chain.current_id
)
select chain.renewed_id, chain.current_id as latest_id
from chain
where chain.status = 'active'
  and not exists (select 1 from public.contracts n where n.previous_contract_id = chain.current_id);

create temporary table renewal_repair_log (
  renewed_id uuid primary key,
  latest_id uuid not null,
  closed_occupants integer not null default 0,
  created_occupants integer not null default 0,
  moved_sources jsonb not null default '[]'::jsonb
) on commit drop;

do $$
declare
  v_correlation_id uuid := gen_random_uuid();
  t record;
  o record;
  s record;
  v_closed integer;
  v_created integer;
  v_sources jsonb;
  v_role text;
  v_building_name text;
  v_building_code text;
  v_building_id uuid;
begin
  raise notice 'Repair correlation_id: %', v_correlation_id;

  for t in select * from renewal_repair_targets order by renewed_id loop
    v_closed := 0;
    v_created := 0;
    v_sources := '[]'::jsonb;

    perform 1 from public.contracts where id in (t.renewed_id, t.latest_id) order by id for update;

    for o in
      select * from public.contract_occupants
      where contract_id = t.renewed_id and move_out_date is null
      order by id for update
    loop
      update public.contract_occupants
        set move_out_date = (select end_date from public.contracts where id = t.renewed_id)
        where id = o.id;
      v_closed := v_closed + 1;
      raise notice 'contract % : closed occupancy % (tenant %)', t.renewed_id, o.id, o.tenant_id;

      if not exists (
        select 1 from public.contract_occupants where tenant_id = o.tenant_id and move_out_date is null
      ) then
        -- Keep a single open primary occupant on the latest contract.
        v_role := case
          when o.role = 'primary' and exists (
            select 1 from public.contract_occupants
            where contract_id = t.latest_id and role = 'primary' and move_out_date is null
          ) then 'roommate'
          else o.role
        end;
        insert into public.contract_occupants (contract_id, tenant_id, role, billing_counted, move_in_date)
        select t.latest_id, o.tenant_id, v_role, o.billing_counted, c.start_date
        from public.contracts c where c.id = t.latest_id;
        v_created := v_created + 1;
        raise notice 'contract % : created occupancy for tenant % on latest contract % as %',
          t.renewed_id, o.tenant_id, t.latest_id, v_role;
      end if;
    end loop;

    for s in
      select id, source_type, public.contract_checkout_source_balance(id) as balance
      from public.contract_checkout_sources
      where contract_id = t.renewed_id and public.contract_checkout_source_balance(id) > 0
      order by id for update
    loop
      update public.contract_checkout_sources
        set contract_id = t.latest_id, updated_at = clock_timestamp()
        where id = s.id;
      v_sources := v_sources || jsonb_build_array(
        jsonb_build_object('id', s.id, 'source_type', s.source_type, 'balance', s.balance));
      raise notice 'contract % : moved source % (balance %) to latest contract %',
        t.renewed_id, s.id, s.balance, t.latest_id;
    end loop;

    insert into renewal_repair_log (renewed_id, latest_id, closed_occupants, created_occupants, moved_sources)
    values (t.renewed_id, t.latest_id, v_closed, v_created, v_sources);

    if v_closed > 0 or v_created > 0 or jsonb_array_length(v_sources) > 0 then
      select c.building_id, b.name, b.code
        into v_building_id, v_building_name, v_building_code
        from public.contracts c join public.buildings b on b.id = c.building_id
        where c.id = t.renewed_id;

      insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
        action, entity_type, entity_id, correlation_id, metadata)
      values (v_building_id, v_building_name, v_building_code, null,
        'contract.renewal.repaired', 'contract', t.renewed_id, v_correlation_id,
        jsonb_build_object('latest_contract_id', t.latest_id, 'closed_occupants', v_closed,
          'created_occupants', v_created, 'moved_sources', v_sources));
    end if;
  end loop;
end;
$$;

-- Reconciliation: every count below must be 0 after the repair.
select count(*) as renewed_contracts_with_open_occupants
from public.contracts c
where c.status = 'renewed'
  and exists (select 1 from renewal_repair_targets t where t.renewed_id = c.id)
  and exists (select 1 from public.contract_occupants o where o.contract_id = c.id and o.move_out_date is null);

select count(*) as renewed_contracts_with_positive_sources
from public.contracts c
where c.status = 'renewed'
  and exists (select 1 from renewal_repair_targets t where t.renewed_id = c.id)
  and exists (select 1 from public.contract_checkout_sources s
    where s.contract_id = c.id and public.contract_checkout_source_balance(s.id) > 0);

select count(*) as latest_contracts_without_open_primary
from public.contracts c
where c.id in (select latest_id from renewal_repair_targets)
  and not exists (select 1 from public.contract_occupants o
    where o.contract_id = c.id and o.role = 'primary' and o.move_out_date is null);

select * from renewal_repair_log order by renewed_id;

-- Dry run by default. Change to COMMIT after reviewing the results above.
rollback;
