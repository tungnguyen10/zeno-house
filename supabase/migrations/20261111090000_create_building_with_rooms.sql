-- =============================================================================
-- Atomic Building + bulk Room creation (V2 PR0)
-- =============================================================================
-- Adds create_rooms_batch (shared core, reused by PR2) and
-- create_building_with_rooms (Building + owner assignment + rooms +
-- idempotency marker in one transaction).
--
-- Data impact: ADDITIVE ONLY. No tables, columns, indexes or policies change.
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
-- regenerate database types:
--   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--     --schema public > app/types/database.types.ts
-- Migration reruns: CREATE OR REPLACE preserves function identities and grants.
-- Requests: the actor-bound audit_operations marker makes retries idempotent.
-- =============================================================================

begin;

create or replace function public.create_rooms_batch(
  p_building_id uuid,
  p_rooms jsonb
) returns setof public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_building_code text;
  v_count integer;
  v_dups jsonb;
  v_room jsonb;
begin
  if p_rooms is null or jsonb_typeof(p_rooms) <> 'array' then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rooms);
  if v_count < 1 or v_count > 200 then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;

  -- Check JSON types before numeric casts so invalid input has one stable error.
  for v_room in select value from jsonb_array_elements(p_rooms) loop
    if jsonb_typeof(v_room) is distinct from 'object'
       or jsonb_typeof(v_room->'room_number') is distinct from 'string'
       or char_length(v_room->>'room_number') not between 1 and 20
       or jsonb_typeof(v_room->'slug') is distinct from 'string'
       or char_length(v_room->>'slug') < 1
       or jsonb_typeof(v_room->'floor') is distinct from 'number'
       or jsonb_typeof(v_room->'monthly_rent') is distinct from 'number'
       or (v_room ? 'area' and jsonb_typeof(v_room->'area') not in ('number', 'null')) then
      raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
    end if;
    if (v_room->>'floor')::numeric not between 1 and 100
       or (v_room->>'floor')::numeric <> trunc((v_room->>'floor')::numeric)
       or (v_room->>'monthly_rent')::numeric < 0
       or (v_room->>'area')::numeric <= 0 then
      raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
    end if;
  end loop;

  select code into v_building_code from public.buildings where id = p_building_id;
  if v_building_code is null then
    raise exception 'BUILDING_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rooms_batch:' || p_building_id::text, 0));

  with input as (
    select r.room_number, r.slug
    from jsonb_to_recordset(p_rooms) as r(room_number text, slug text)
  )
  select coalesce(jsonb_agg(distinct d.room_number order by d.room_number), '[]'::jsonb)
  into v_dups
  from (
    select i.room_number
    from input i
    where (select count(*) from input j where j.room_number = i.room_number or j.slug = i.slug) > 1
       or exists (
         select 1 from public.rooms r
         where r.building_id = p_building_id
           and (r.room_number = i.room_number or r.slug = i.slug)
       )
  ) d;

  if jsonb_array_length(v_dups) > 0 then
    raise exception 'ROOM_BATCH_DUPLICATE' using errcode = '23505', detail = v_dups::text;
  end if;

  return query
  insert into public.rooms (building_id, room_number, slug, code, floor, status, monthly_rent, area)
  select p_building_id, r.room_number, r.slug, v_building_code || '-' || r.slug,
         r.floor::integer, 'available', r.monthly_rent, r.area
  from jsonb_to_recordset(p_rooms) as r(room_number text, slug text, floor numeric, monthly_rent numeric, area numeric)
  returning *;
end;
$$;

revoke all on function public.create_rooms_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_rooms_batch(uuid, jsonb) to service_role;

create or replace function public.create_building_with_rooms(
  p_building jsonb,
  p_rooms jsonb,
  p_assign_owner uuid,
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
  v_building public.buildings%rowtype;
  v_rooms jsonb := '[]'::jsonb;
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'BUILDING_SETUP_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  v_key := 'building.create:' || p_request_id::text;
  -- Concurrent retries with the same key wait here, then replay.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.entity_id is null then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select * into v_building from public.buildings where id = v_op.entity_id;
    if not found then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.rooms r where r.building_id = v_building.id;
    return jsonb_build_object('building', to_jsonb(v_building), 'rooms', v_rooms, 'replayed', true);
  end if;

  insert into public.buildings (
    slug, code, name, address, description, status,
    owner_name, owner_phone, owner_email, created_by, owner_user_id,
    electricity_pricing_type, default_electricity_rate,
    water_pricing_type, default_water_rate,
    meter_reading_day, billing_generation_day, payment_due_day, grace_period_days,
    operational_start_year, operational_start_month
  )
  select
    b.slug, b.code, b.name, b.address, b.description, b.status,
    b.owner_name, b.owner_phone, b.owner_email, b.created_by, b.owner_user_id,
    b.electricity_pricing_type, b.default_electricity_rate,
    b.water_pricing_type, b.default_water_rate,
    b.meter_reading_day, b.billing_generation_day, b.payment_due_day, b.grace_period_days,
    b.operational_start_year, b.operational_start_month
  from jsonb_populate_record(null::public.buildings, p_building) b
  returning * into v_building;

  if p_assign_owner is not null then
    insert into public.user_building_assignments (user_id, building_id, can_delete_master_data, created_by)
    values (p_assign_owner, v_building.id, false, p_actor_id);
  end if;

  -- NULL and [] mean Building-only. Reject malformed payloads rather than
  -- silently committing a Building after dropping the requested rooms.
  if p_rooms is not null and jsonb_typeof(p_rooms) <> 'array' then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;
  if p_rooms is not null and jsonb_array_length(p_rooms) > 0 then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.create_rooms_batch(v_building.id, p_rooms) r;
  end if;

  -- Completed marker only; the outbox reconciler claims pending/executing rows.
  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id,
    intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, v_building.id, 'building.create', 'building', v_building.id,
    jsonb_build_object('room_count', jsonb_array_length(v_rooms)), 'completed', now()
  );

  return jsonb_build_object('building', to_jsonb(v_building), 'rooms', v_rooms, 'replayed', false);
end;
$$;

revoke all on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) to service_role;

commit;
