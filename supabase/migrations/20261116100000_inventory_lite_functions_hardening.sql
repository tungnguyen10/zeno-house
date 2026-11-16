-- Re-applies the hardened inventory RPCs from 20261112005547. 20261111110000 sorts earlier but
-- was applied to production later and replaced them with weaker versions.
-- Requires validate_inventory_items from 20261112005547.
begin;

create or replace function public.apply_inventory_template(
  p_building_id uuid,
  p_room_ids uuid[],
  p_mode text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room uuid;
  v_locked public.rooms%rowtype;
  v_locked_count integer := 0;
  v_template_count integer;
  v_merged_count integer;
  v_added integer;
  v_result jsonb := '{}'::jsonb;
begin
  if p_mode is null or p_mode not in ('merge', 'replace') then
    raise exception 'INVENTORY_MODE_INVALID' using errcode = '22023';
  end if;
  if p_room_ids is null or cardinality(p_room_ids) < 1 or cardinality(p_room_ids) > 200
     or array_ndims(p_room_ids) is distinct from 1
     or exists (select 1 from unnest(p_room_ids) as ids(id) where ids.id is null)
     or (select count(distinct ids.id) from unnest(p_room_ids) as ids(id)) <> cardinality(p_room_ids) then
    raise exception 'INVENTORY_ROOMS_INVALID' using errcode = '22023';
  end if;
  if p_building_id is null then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_building_id::text, 0));
  -- Lock all requested rooms in stable order; validate the locked row versions
  -- before any deletion/insertion. Mixed-building batches never partially apply.
  for v_locked in
    select r.* from public.rooms r where r.id = any(p_room_ids) order by r.id for update
  loop
    if v_locked.building_id is distinct from p_building_id then
      raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
    end if;
    v_locked_count := v_locked_count + 1;
  end loop;
  if v_locked_count <> cardinality(p_room_ids) then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;
  select count(*) into v_template_count from public.building_inventory_templates where building_id = p_building_id;
  if v_template_count > 50 then
    raise exception 'INVENTORY_ITEMS_LIMIT' using errcode = '22023';
  end if;
  -- Preflight every merged list before mutating the first room.
  if p_mode = 'merge' then
    foreach v_room in array p_room_ids loop
      select count(*) into v_merged_count from (
        select lower(btrim(i.name)) from public.room_inventory_items i where i.room_id = v_room
        union
        select lower(btrim(t.name)) from public.building_inventory_templates t where t.building_id = p_building_id
      ) names;
      if v_merged_count > 50 then
        raise exception 'INVENTORY_ITEMS_LIMIT' using errcode = '22023';
      end if;
    end loop;
  end if;
  foreach v_room in array p_room_ids loop
    if p_mode = 'replace' then
      delete from public.room_inventory_items where room_id = v_room;
    end if;
    insert into public.room_inventory_items (room_id, name, quantity, condition, unit_value, note, sort_order)
    select v_room, t.name, t.quantity, t.condition, t.unit_value, t.note, t.sort_order
    from public.building_inventory_templates t
    where t.building_id = p_building_id and not exists (
      select 1 from public.room_inventory_items i
      where i.room_id = v_room and lower(btrim(i.name)) = lower(btrim(t.name))
    );
    get diagnostics v_added = row_count;
    v_result := v_result || jsonb_build_object(v_room::text, v_added);
  end loop;
  return v_result;
end;
$$;
revoke all on function public.apply_inventory_template(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_inventory_template(uuid, uuid[], text) to service_role;

create or replace function public.create_rooms_batch_idempotent(
  p_building_id uuid,
  p_rooms jsonb,
  p_apply_inventory boolean,
  p_actor_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_op public.audit_operations%rowtype;
  v_rooms jsonb;
  v_ids uuid[];
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'BUILDING_SETUP_REQUEST_REQUIRED' using errcode = '22023';
  end if;
  if p_apply_inventory is null then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;
  v_key := 'rooms.batch:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.building_id is distinct from p_building_id
       or v_op.entity_id is distinct from p_building_id or v_op.status <> 'completed' then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    v_ids := array(select jsonb_array_elements_text(v_op.intent_data->'room_ids')::uuid);
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb) into v_rooms
    from public.rooms r where r.id = any(v_ids) and r.building_id = p_building_id;
    if cardinality(v_ids) not between 1 and 200 or jsonb_array_length(v_rooms) <> cardinality(v_ids) then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('rooms', v_rooms, 'replayed', true);
  end if;
  -- Same lock as template replacement/application: capture one committed template.
  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_building_id::text, 0));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb), array_agg(r.id)
  into v_rooms, v_ids from public.create_rooms_batch(p_building_id, p_rooms) r;
  if p_apply_inventory then
    perform public.apply_inventory_template(p_building_id, v_ids, 'merge');
  end if;
  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id, intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, p_building_id, 'rooms.batch_create', 'building', p_building_id,
    jsonb_build_object('room_ids', to_jsonb(v_ids), 'apply_inventory', p_apply_inventory), 'completed', now()
  );
  return jsonb_build_object('rooms', v_rooms, 'replayed', false);
end;
$$;
revoke all on function public.create_rooms_batch_idempotent(uuid, jsonb, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_rooms_batch_idempotent(uuid, jsonb, boolean, uuid, uuid) to service_role;

-- Exact 17-parameter signature from 20261001143337; only inventory is appended.
create or replace function public.create_contract_with_handover_and_inventory(
  p_room_id uuid,
  p_tenant_id uuid,
  p_building_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count integer,
  p_discount_amount numeric,
  p_surcharge_amount numeric,
  p_status text,
  p_notes text,
  p_handover_electricity_reading numeric,
  p_handover_water_reading numeric,
  p_handover_reading_date date,
  p_recorded_by uuid,
  p_inventory jsonb
) returns setof public.contracts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract public.contracts%rowtype;
begin
  if p_building_id is null then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_building_id::text, 0));
  -- Match the underlying contract/renewal advisory lock before taking a room lock.
  perform pg_advisory_xact_lock(hashtextextended(p_building_id::text, 1));
  perform 1 from public.rooms r where r.id = p_room_id and r.building_id = p_building_id for update;
  if not found then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;
  select * into v_contract from public.create_contract_with_handover(
    p_room_id, p_tenant_id, p_building_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, p_discount_amount, p_surcharge_amount, p_status, p_notes,
    p_handover_electricity_reading, p_handover_water_reading, p_handover_reading_date, p_recorded_by
  );
  -- Any validation/insert failure also rolls back the contract and both readings.
  -- Empty [] is valid; SQL NULL/JSON null and non-arrays are rejected explicitly.
  perform public.validate_inventory_items(p_inventory);
  insert into public.contract_inventory_items (contract_id, name, quantity, condition, unit_value, note, sort_order)
  select v_contract.id, btrim(e.item->>'name'), (e.item->>'quantity')::numeric::integer,
         e.item->>'condition', (e.item->>'unit_value')::numeric, e.item->>'note', (e.ord - 1)::integer
  from jsonb_array_elements(p_inventory) with ordinality as e(item, ord);
  return next v_contract;
end;
$$;
revoke all on function public.create_contract_with_handover_and_inventory(uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_contract_with_handover_and_inventory(uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb) to service_role;

commit;
