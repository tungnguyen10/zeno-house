-- Apply through Dashboard SQL Editor; regenerate cloud database types afterwards.
begin;

create or replace function public.bulk_tenant_status_action(
  p_action text,
  p_items jsonb
)
returns table (id uuid, succeeded boolean, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_locked_id uuid;
  v_expected_building_ids uuid[];
  v_actual_building_ids uuid[];
begin
  if p_action is null or p_action not in ('archive', 'activate') then
    raise exception using errcode = '22023', message = 'Unsupported tenant status action';
  end if;
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Tenant status items must be an array';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_items) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
      or pg_catalog.jsonb_typeof(item.value -> 'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(item.value -> 'expected_building_ids') is distinct from 'array'
  ) then
    raise exception using errcode = '22023', message = 'Each tenant status item requires an id and building snapshot';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_items) as item(value)
    cross join lateral pg_catalog.jsonb_array_elements(item.value -> 'expected_building_ids') as building(value)
    where pg_catalog.jsonb_typeof(building.value) is distinct from 'string'
  ) then
    raise exception using errcode = '22023', message = 'Building snapshot must contain UUID strings';
  end if;

  -- First snapshot wins for duplicate IDs; UUID ordering makes tenant lock order stable.
  for v_item in
    select unique_items.tenant_id, unique_items.expected_building_ids
    from (
      select distinct on (requested.tenant_id)
        requested.tenant_id, requested.expected_building_ids
      from (
        select (item.value ->> 'id')::uuid as tenant_id,
          item.value -> 'expected_building_ids' as expected_building_ids,
          item.ordinality
        from pg_catalog.jsonb_array_elements(p_items) with ordinality as item(value, ordinality)
      ) requested
      order by requested.tenant_id, requested.ordinality
    ) unique_items
    order by unique_items.tenant_id
  loop
    id := v_item.tenant_id;
    succeeded := false;
    reason := null;
    select t.id into v_locked_id
    from public.tenants t
    where t.id = v_item.tenant_id
    for update;
    if not found then
      reason := 'not_found';
      return next;
      continue;
    end if;

    select coalesce(pg_catalog.array_agg(distinct building.value::uuid order by building.value::uuid), '{}'::uuid[])
    into v_expected_building_ids
    from pg_catalog.jsonb_array_elements_text(v_item.expected_building_ids) as building(value);

    -- An open occupant counts even if its parent contract has ended. No date rules here.
    select coalesce(pg_catalog.array_agg(active.building_id order by active.building_id), '{}'::uuid[])
    into v_actual_building_ids
    from (
      select c.building_id
      from public.contracts c
      where c.tenant_id = v_item.tenant_id and c.status = 'active'
      union
      select c.building_id
      from public.contract_occupants o
      join public.contracts c on c.id = o.contract_id
      where o.tenant_id = v_item.tenant_id
        and o.move_out_date is null
    ) active;

    if v_actual_building_ids is distinct from v_expected_building_ids then
      reason := 'conflict';
      return next;
      continue;
    end if;

    -- Preserve existing bulk semantics: an already-target tenant also succeeds.
    update public.tenants t
    set status = case p_action when 'archive' then 'archived' else 'active' end
    where t.id = v_item.tenant_id;
    succeeded := true;
    return next;
  end loop;
end;
$$;

revoke all on function public.bulk_tenant_status_action(text, jsonb) from public, anon, authenticated;
grant execute on function public.bulk_tenant_status_action(text, jsonb) to service_role;

commit;
