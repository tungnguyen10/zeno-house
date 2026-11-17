-- Atomic handover inventory replacement and one-query handover lookup.
-- Requires validate_inventory_items from 20261112005547 and contract_documents from 20261111130000.
begin;

-- Validate, delete and insert in one transaction; refuses once a contract document is issued/signed.
create or replace function public.replace_contract_inventory(
  p_contract_id uuid,
  p_items jsonb
) returns setof public.contract_inventory_items
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.contracts c where c.id = p_contract_id for update;
  if not found then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.contract_documents d
    where d.contract_id = p_contract_id
      and d.type = 'contract' and d.status in ('issued', 'signed')
  ) then
    raise exception 'CONTRACT_INVENTORY_LOCKED' using errcode = '23514';
  end if;
  perform public.validate_inventory_items(p_items);
  delete from public.contract_inventory_items where contract_id = p_contract_id;
  return query
  insert into public.contract_inventory_items (contract_id, name, quantity, condition, unit_value, note, sort_order)
  select p_contract_id, btrim(e.item->>'name'), (e.item->>'quantity')::numeric::integer,
         e.item->>'condition', (e.item->>'unit_value')::numeric, e.item->>'note', (e.ord - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  returning *;
end;
$$;
revoke all on function public.replace_contract_inventory(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_contract_inventory(uuid, jsonb) to service_role;

-- Nearest contract in the renewal chain (itself first) that has handover items; depth capped at 20.
create or replace function public.find_handover_inventory(
  p_contract_id uuid
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive chain as (
    select c.id, c.contract_code, c.previous_contract_id, 0 as depth
    from public.contracts c
    where c.id = p_contract_id
    union all
    select c.id, c.contract_code, c.previous_contract_id, ch.depth + 1
    from public.contracts c
    join chain ch on c.id = ch.previous_contract_id
    where ch.depth < 19
  ),
  source as (
    select ch.id, ch.contract_code
    from chain ch
    where exists (select 1 from public.contract_inventory_items i where i.contract_id = ch.id)
    order by ch.depth
    limit 1
  )
  select coalesce(
    (
      select jsonb_build_object(
        'source_contract_id', s.id,
        'source_contract_code', s.contract_code,
        'items', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', i.id, 'name', i.name, 'quantity', i.quantity, 'condition', i.condition,
              'unit_value', i.unit_value, 'note', i.note, 'sort_order', i.sort_order
            ) order by i.sort_order
          ), '[]'::jsonb)
          from public.contract_inventory_items i
          where i.contract_id = s.id
        )
      )
      from source s
    ),
    jsonb_build_object('source_contract_id', null, 'source_contract_code', null, 'items', '[]'::jsonb)
  );
$$;
revoke all on function public.find_handover_inventory(uuid) from public, anon, authenticated;
grant execute on function public.find_handover_inventory(uuid) to service_role;

commit;

-- Verify
select p.proname, has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('replace_contract_inventory', 'find_handover_inventory');
