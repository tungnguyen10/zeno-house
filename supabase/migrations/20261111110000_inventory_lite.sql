-- =============================================================================
-- Inventory lite (V2 PR2)
-- =============================================================================
-- Building inventory templates, room inventory, contract handover inventory,
-- plus wrapper RPCs. Existing RPCs are NOT modified.
-- Requires PR0 migration (create_rooms_batch).
--
-- Data impact: ADDITIVE ONLY.
-- Execution model: apply in Supabase Dashboard SQL Editor, then regenerate types.
-- =============================================================================

-- ---------- tables ----------
create table if not exists public.building_inventory_templates (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 999),
  condition text not null default 'good' check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists building_inventory_templates_name_uq
  on public.building_inventory_templates (building_id, lower(name));

create table if not exists public.room_inventory_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 999),
  condition text not null default 'good' check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists room_inventory_items_name_uq
  on public.room_inventory_items (room_id, lower(name));

create table if not exists public.contract_inventory_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null check (quantity between 1 and 999),
  condition text not null check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contract_inventory_items_contract_idx on public.contract_inventory_items (contract_id);

drop trigger if exists building_inventory_templates_set_updated_at on public.building_inventory_templates;
create trigger building_inventory_templates_set_updated_at
  before update on public.building_inventory_templates
  for each row execute function public.set_updated_at();

drop trigger if exists room_inventory_items_set_updated_at on public.room_inventory_items;
create trigger room_inventory_items_set_updated_at
  before update on public.room_inventory_items
  for each row execute function public.set_updated_at();

alter table public.building_inventory_templates enable row level security;
alter table public.room_inventory_items enable row level security;
alter table public.contract_inventory_items enable row level security;
revoke all on table public.building_inventory_templates from public, anon, authenticated;
revoke all on table public.room_inventory_items from public, anon, authenticated;
revoke all on table public.contract_inventory_items from public, anon, authenticated;
grant select, insert, update, delete on table public.building_inventory_templates to service_role;
grant select, insert, update, delete on table public.room_inventory_items to service_role;
grant select, insert, update, delete on table public.contract_inventory_items to service_role;

-- ---------- apply_inventory_template ----------
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
  v_added integer;
  v_result jsonb := '{}'::jsonb;
begin
  if p_mode not in ('merge', 'replace') then
    raise exception 'INVENTORY_MODE_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_room_ids) as rid
    where not exists (select 1 from public.rooms r where r.id = rid and r.building_id = p_building_id)
  ) then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_building_id::text, 0));

  foreach v_room in array p_room_ids loop
    if p_mode = 'replace' then
      delete from public.room_inventory_items where room_id = v_room;
    end if;
    insert into public.room_inventory_items (room_id, name, quantity, condition, unit_value, note, sort_order)
    select v_room, t.name, t.quantity, t.condition, t.unit_value, t.note, t.sort_order
    from public.building_inventory_templates t
    where t.building_id = p_building_id
      and not exists (
        select 1 from public.room_inventory_items i
        where i.room_id = v_room and lower(i.name) = lower(t.name)
      );
    get diagnostics v_added = row_count;
    v_result := v_result || jsonb_build_object(v_room::text, v_added);
  end loop;

  return v_result;
end;
$$;
revoke all on function public.apply_inventory_template(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_inventory_template(uuid, uuid[], text) to service_role;

-- ---------- create_rooms_batch_idempotent ----------
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
  v_key := 'rooms.batch:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.building_id is distinct from p_building_id then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.rooms r
    where r.id = any (array(select jsonb_array_elements_text(v_op.intent_data->'room_ids')::uuid));
    return jsonb_build_object('rooms', v_rooms, 'replayed', true);
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb), array_agg(r.id)
  into v_rooms, v_ids
  from public.create_rooms_batch(p_building_id, p_rooms) r;

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

-- ---------- create_contract_with_handover_and_inventory ----------
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
  select * into v_contract from public.create_contract_with_handover(
    p_room_id, p_tenant_id, p_building_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, p_discount_amount, p_surcharge_amount, p_status, p_notes,
    p_handover_electricity_reading, p_handover_water_reading, p_handover_reading_date, p_recorded_by
  );

  if p_inventory is not null and jsonb_typeof(p_inventory) = 'array' and jsonb_array_length(p_inventory) > 0 then
    if jsonb_array_length(p_inventory) > 50 then
      raise exception 'CONTRACT_INVENTORY_INVALID' using errcode = '22023';
    end if;
    insert into public.contract_inventory_items (contract_id, name, quantity, condition, unit_value, note, sort_order)
    select v_contract.id, i.name, i.quantity, i.condition, i.unit_value, i.note, (i.ord - 1)::integer
    from jsonb_to_recordset(p_inventory) with ordinality
      as i(name text, quantity integer, condition text, unit_value numeric, note text, ord bigint);
  end if;

  return next v_contract;
end;
$$;
revoke all on function public.create_contract_with_handover_and_inventory(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_contract_with_handover_and_inventory(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb
) to service_role;
