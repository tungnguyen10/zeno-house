-- =============================================================================
-- Contract quick create (V2 PR4a)
-- =============================================================================
-- contract_vehicles + create_contract_full (contract, handover, inventory,
-- roommates, vehicles, services, room status) in one transaction.
-- Requires PR2 (create_contract_with_handover_and_inventory).
-- Data impact: ADDITIVE ONLY.
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
-- regenerate database types.
-- =============================================================================

create table if not exists public.contract_vehicles (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  owner_name text not null check (length(trim(owner_name)) between 1 and 100),
  plate_number text not null check (length(plate_number) between 1 and 20),
  vehicle_type text check (vehicle_type is null or length(vehicle_type) <= 50),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_vehicles_plate_uq unique (contract_id, plate_number)
);

drop trigger if exists contract_vehicles_set_updated_at on public.contract_vehicles;
create trigger contract_vehicles_set_updated_at
  before update on public.contract_vehicles
  for each row execute function public.set_updated_at();

alter table public.contract_vehicles enable row level security;
revoke all on table public.contract_vehicles from public, anon, authenticated;
grant select, insert, update, delete on table public.contract_vehicles to service_role;

create or replace function public.create_contract_full(
  p_contract jsonb,
  p_inventory jsonb,
  p_occupants jsonb,
  p_vehicles jsonb,
  p_services jsonb,
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
  v_contract public.contracts%rowtype;
  v_occupant_count integer;
  v_roommates integer := coalesce(jsonb_array_length(p_occupants), 0);
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'CONTRACT_CREATE_REQUEST_REQUIRED' using errcode = '22023';
  end if;
  v_key := 'contract.create:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.entity_id is null then
      raise exception 'CONTRACT_CREATE_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('contract_id', v_op.entity_id, 'replayed', true);
  end if;

  v_occupant_count := coalesce((p_contract->>'occupant_count')::integer, 1);
  if 1 + v_roommates > v_occupant_count then
    raise exception 'CONTRACT_OCCUPANT_LIMIT' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_occupants, '[]'::jsonb)) o
    where (o->>'tenant_id')::uuid = (p_contract->>'tenant_id')::uuid
  ) then
    raise exception 'CONTRACT_OCCUPANT_PRIMARY' using errcode = '23514';
  end if;

  select * into v_contract from public.create_contract_with_handover_and_inventory(
    (p_contract->>'room_id')::uuid,
    (p_contract->>'tenant_id')::uuid,
    (p_contract->>'building_id')::uuid,
    (p_contract->>'start_date')::date,
    (p_contract->>'end_date')::date,
    (p_contract->>'monthly_rent')::numeric,
    coalesce((p_contract->>'deposit')::numeric, 0),
    (p_contract->>'payment_due_day')::smallint,
    v_occupant_count,
    coalesce((p_contract->>'discount_amount')::numeric, 0),
    coalesce((p_contract->>'surcharge_amount')::numeric, 0),
    coalesce(p_contract->>'status', 'active'),
    p_contract->>'notes',
    (p_contract->>'handover_electricity_reading')::numeric,
    (p_contract->>'handover_water_reading')::numeric,
    (p_contract->>'handover_reading_date')::date,
    (p_contract->>'recorded_by')::uuid,
    p_inventory
  );

  begin
    insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date, billing_counted)
    select v_contract.id, (o->>'tenant_id')::uuid, 'roommate',
           coalesce((o->>'move_in_date')::date, v_contract.start_date),
           coalesce((o->>'billing_counted')::boolean, true)
    from jsonb_array_elements(coalesce(p_occupants, '[]'::jsonb)) o;
  exception when unique_violation then
    raise exception 'CONTRACT_OCCUPANT_BUSY' using errcode = '23505';
  end;

  begin
    insert into public.contract_vehicles (contract_id, owner_name, plate_number, vehicle_type, note, sort_order)
    select v_contract.id, v->>'owner_name', v->>'plate_number', v->>'vehicle_type', v->>'note', (ord - 1)::integer
    from jsonb_array_elements(coalesce(p_vehicles, '[]'::jsonb)) with ordinality as e(v, ord);
  exception when unique_violation then
    raise exception 'CONTRACT_VEHICLE_DUPLICATE' using errcode = '23505';
  end;

  if p_services is null then
    insert into public.contract_services (contract_id, catalog_id, amount, quantity, is_enabled)
    select v_contract.id, bs.catalog_id, bs.default_amount, 1, true
    from public.building_services bs
    where bs.building_id = v_contract.building_id and bs.is_active;
  else
    if exists (
      select 1 from jsonb_array_elements(p_services) s
      where not exists (
        select 1 from public.building_services bs
        where bs.building_id = v_contract.building_id and bs.catalog_id = (s->>'catalog_id')::uuid
      )
    ) then
      raise exception 'CONTRACT_SERVICE_INVALID' using errcode = '23514';
    end if;
    insert into public.contract_services (contract_id, catalog_id, amount, quantity, is_enabled, notes)
    select v_contract.id, (s->>'catalog_id')::uuid, (s->>'amount')::numeric,
           coalesce((s->>'quantity')::integer, 1), coalesce((s->>'is_enabled')::boolean, true), s->>'notes'
    from jsonb_array_elements(p_services) s;
  end if;

  if v_contract.status = 'active' then
    update public.rooms set status = 'occupied' where id = v_contract.room_id;
  end if;

  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id, intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, v_contract.building_id, 'contract.create', 'contract', v_contract.id,
    jsonb_build_object('occupants', v_roommates, 'vehicles', coalesce(jsonb_array_length(p_vehicles), 0)),
    'completed', now()
  );

  return jsonb_build_object('contract_id', v_contract.id, 'replayed', false);
end;
$$;

revoke all on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) to service_role;
