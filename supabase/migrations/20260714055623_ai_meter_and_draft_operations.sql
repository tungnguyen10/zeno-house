-- =============================================================================
-- AI meter and draft operations
-- =============================================================================
-- Server-only SECURITY INVOKER RPCs for atomic billing-input writes. The Nuxt
-- service authenticates and authorizes the actor before invoking these through
-- the service-role client. SQL repeats relationship, lock, and version checks
-- inside the transaction to close time-of-check/time-of-use races.
-- =============================================================================

create or replace function public.save_meter_readings_with_audit(
  p_readings jsonb,
  p_actor_id uuid,
  p_source text default 'api',
  p_action_plan_id uuid default null,
  p_idempotency_key uuid default null
)
returns setof public.meter_readings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_room public.rooms%rowtype;
  v_period public.billing_periods%rowtype;
  v_existing public.meter_readings%rowtype;
  v_saved public.meter_readings%rowtype;
  v_room_id uuid;
  v_meter_type text;
  v_reading_type text;
  v_period_year integer;
  v_period_month integer;
  v_reading_date date;
  v_reading_value numeric;
  v_expected_updated_at timestamptz;
  v_before jsonb;
begin
  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'METER_INPUT_INVALID';
  end if;
  if p_source not in ('api', 'ai') then
    raise exception using errcode = '22023', message = 'METER_SOURCE_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_readings) item
    group by
      item->>'room_id', item->>'meter_type', item->>'period_year',
      item->>'period_month', item->>'reading_type'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'METER_DUPLICATE_INPUT';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_readings) item
    order by
      item->>'period_year', item->>'period_month', item->>'room_id',
      item->>'meter_type', item->>'reading_type'
  loop
    begin
      v_room_id := (v_item->>'room_id')::uuid;
      v_meter_type := v_item->>'meter_type';
      v_reading_type := v_item->>'reading_type';
      v_period_year := (v_item->>'period_year')::integer;
      v_period_month := (v_item->>'period_month')::integer;
      v_reading_date := (v_item->>'reading_date')::date;
      v_reading_value := (v_item->>'reading_value')::numeric;
      v_expected_updated_at := nullif(v_item->>'expected_updated_at', '')::timestamptz;
    exception when others then
      raise exception using errcode = '22023', message = 'METER_INPUT_INVALID';
    end;

    if v_meter_type not in ('electricity', 'water')
      or v_reading_type not in ('monthly', 'handover_in', 'handover_out')
      or v_period_year not between 2000 and 2100
      or v_period_month not between 1 and 12
      or v_reading_value < 0 then
      raise exception using errcode = '22023', message = 'METER_INPUT_INVALID';
    end if;

    select room.* into v_room
    from public.rooms room
    where room.id = v_room_id;
    if not found then
      raise exception using errcode = '22023', message = 'METER_ROOM_INVALID';
    end if;

    v_period := null;
    if v_reading_type = 'monthly' then
      select period.* into v_period
      from public.billing_periods period
      where period.building_id = v_room.building_id
        and period.period_year = v_period_year
        and period.period_month = v_period_month
      for update;

      if v_period.id is not null and v_period.status = 'closed' then
        raise exception using errcode = 'P0001', message = 'BILLING_PERIOD_LOCKED';
      end if;
      if v_period.id is not null and exists (
        select 1
        from public.invoices invoice
        where invoice.billing_period_id = v_period.id
          and invoice.room_id = v_room_id
          and invoice.status <> 'void'
      ) then
        raise exception using errcode = 'P0001', message = 'BILLING_INVOICE_LOCKED';
      end if;
    end if;

    v_existing := null;
    select reading.* into v_existing
    from public.meter_readings reading
    where reading.room_id = v_room_id
      and reading.meter_type = v_meter_type
      and reading.period_year = v_period_year
      and reading.period_month = v_period_month
      and reading.reading_type = v_reading_type
    for update;

    if v_existing.id is null then
      if v_expected_updated_at is not null then
        raise exception using errcode = 'P0001', message = 'METER_VERSION_CONFLICT';
      end if;
      v_before := null;
    else
      if v_expected_updated_at is null or v_existing.updated_at is distinct from v_expected_updated_at then
        raise exception using errcode = 'P0001', message = 'METER_VERSION_CONFLICT';
      end if;
      v_before := to_jsonb(v_existing);
    end if;

    insert into public.meter_readings (
      room_id, building_id, meter_type, reading_type, period_year, period_month,
      reading_date, reading_value, is_estimated, notes, recorded_by, updated_by,
      updated_at
    )
    values (
      v_room_id, v_room.building_id, v_meter_type, v_reading_type,
      v_period_year, v_period_month, v_reading_date, v_reading_value,
      coalesce((v_item->>'is_estimated')::boolean, false), v_item->>'notes',
      p_actor_id, p_actor_id, clock_timestamp()
    )
    on conflict on constraint meter_readings_room_type_period_unique do update
    set reading_date = excluded.reading_date,
        reading_value = excluded.reading_value,
        is_estimated = excluded.is_estimated,
        notes = excluded.notes,
        recorded_by = excluded.recorded_by,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    returning * into v_saved;

    insert into public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      before_data, after_data, metadata
    )
    values (
      v_period.id,
      p_actor_id,
      'reading.saved',
      'meter_reading',
      v_saved.id,
      v_before,
      to_jsonb(v_saved),
      jsonb_strip_nulls(jsonb_build_object(
        'count', 1,
        'meter_type', v_saved.meter_type,
        'previous_value', v_existing.reading_value,
        'new_value', v_saved.reading_value,
        'unit', case when v_saved.meter_type = 'electricity' then 'kWh' else 'm³' end,
        'reading_date', v_saved.reading_date,
        'source', p_source,
        'action_plan_id', p_action_plan_id,
        'idempotency_key', p_idempotency_key
      ))
    );

    return next v_saved;
  end loop;
end;
$$;

create or replace function public.save_utility_usage_override_with_audit(
  p_billing_period_id uuid,
  p_override jsonb,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_source text default 'api',
  p_action_plan_id uuid default null,
  p_idempotency_key uuid default null
)
returns setof public.billing_utility_usages
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.billing_periods%rowtype;
  v_room public.rooms%rowtype;
  v_existing public.billing_utility_usages%rowtype;
  v_saved public.billing_utility_usages%rowtype;
  v_room_id uuid;
  v_meter_type text;
  v_before jsonb;
begin
  if jsonb_typeof(p_override) <> 'object' or p_source not in ('api', 'ai') then
    raise exception using errcode = '22023', message = 'UTILITY_OVERRIDE_INPUT_INVALID';
  end if;
  begin
    v_room_id := (p_override->>'room_id')::uuid;
    v_meter_type := p_override->>'meter_type';
  exception when others then
    raise exception using errcode = '22023', message = 'UTILITY_OVERRIDE_INPUT_INVALID';
  end;
  if v_meter_type not in ('electricity', 'water') then
    raise exception using errcode = '22023', message = 'UTILITY_OVERRIDE_INPUT_INVALID';
  end if;

  select period.* into v_period
  from public.billing_periods period
  where period.id = p_billing_period_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'UTILITY_OVERRIDE_PERIOD_INVALID';
  end if;
  if v_period.status = 'closed' then
    raise exception using errcode = 'P0001', message = 'BILLING_PERIOD_LOCKED';
  end if;

  select room.* into v_room
  from public.rooms room
  where room.id = v_room_id;
  if not found or v_room.building_id <> v_period.building_id then
    raise exception using errcode = '22023', message = 'UTILITY_OVERRIDE_ROOM_INVALID';
  end if;
  if exists (
    select 1
    from public.invoices invoice
    where invoice.billing_period_id = p_billing_period_id
      and invoice.room_id = v_room_id
      and invoice.status <> 'void'
  ) then
    raise exception using errcode = 'P0001', message = 'BILLING_INVOICE_LOCKED';
  end if;

  v_existing := null;
  select usage.* into v_existing
  from public.billing_utility_usages usage
  where usage.billing_period_id = p_billing_period_id
    and usage.room_id = v_room_id
    and usage.meter_type = v_meter_type
  for update;

  if v_existing.id is null then
    if p_expected_updated_at is not null then
      raise exception using errcode = 'P0001', message = 'UTILITY_OVERRIDE_VERSION_CONFLICT';
    end if;
    v_before := null;
  else
    if p_expected_updated_at is null or v_existing.updated_at is distinct from p_expected_updated_at then
      raise exception using errcode = 'P0001', message = 'UTILITY_OVERRIDE_VERSION_CONFLICT';
    end if;
    v_before := to_jsonb(v_existing);
  end if;

  insert into public.billing_utility_usages (
    billing_period_id, room_id, meter_type,
    previous_reading_id, previous_reading_value,
    current_reading_id, current_reading_value,
    old_meter_final_value, new_meter_start_value,
    billable_usage, reason, note, created_by, updated_at
  )
  values (
    p_billing_period_id,
    v_room_id,
    v_meter_type,
    nullif(p_override->>'previous_reading_id', '')::uuid,
    (p_override->>'previous_reading_value')::numeric,
    nullif(p_override->>'current_reading_id', '')::uuid,
    (p_override->>'current_reading_value')::numeric,
    nullif(p_override->>'old_meter_final_value', '')::numeric,
    nullif(p_override->>'new_meter_start_value', '')::numeric,
    (p_override->>'billable_usage')::numeric,
    p_override->>'reason',
    p_override->>'note',
    p_actor_id,
    clock_timestamp()
  )
  on conflict on constraint billing_utility_usages_period_room_meter_uq do update
  set previous_reading_id = excluded.previous_reading_id,
      previous_reading_value = excluded.previous_reading_value,
      current_reading_id = excluded.current_reading_id,
      current_reading_value = excluded.current_reading_value,
      old_meter_final_value = excluded.old_meter_final_value,
      new_meter_start_value = excluded.new_meter_start_value,
      billable_usage = excluded.billable_usage,
      reason = excluded.reason,
      note = excluded.note,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at
  returning * into v_saved;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  )
  values (
    p_billing_period_id,
    p_actor_id,
    'utility_override.saved',
    'billing_utility_usage',
    v_saved.id,
    v_before,
    to_jsonb(v_saved),
    jsonb_strip_nulls(jsonb_build_object(
      'room_id', v_saved.room_id,
      'meter_type', v_saved.meter_type,
      'reason', v_saved.reason,
      'source', p_source,
      'action_plan_id', p_action_plan_id,
      'idempotency_key', p_idempotency_key
    ))
  );

  return next v_saved;
end;
$$;

revoke all on function public.save_meter_readings_with_audit(jsonb, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.save_meter_readings_with_audit(jsonb, uuid, text, uuid, uuid)
  to service_role;

revoke all on function public.save_utility_usage_override_with_audit(uuid, jsonb, timestamptz, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.save_utility_usage_override_with_audit(uuid, jsonb, timestamptz, uuid, text, uuid, uuid)
  to service_role;

comment on function public.save_meter_readings_with_audit(jsonb, uuid, text, uuid, uuid)
  is 'Server-only atomic meter reading upsert with billing locks, optimistic versions, and audit rows.';
comment on function public.save_utility_usage_override_with_audit(uuid, jsonb, timestamptz, uuid, text, uuid, uuid)
  is 'Server-only atomic utility usage override upsert with billing locks, optimistic version, and audit row.';

-- Verification after applying:
-- 1. Call each function through the service role with a valid fixture.
-- 2. Force an audit insert failure and verify no domain row changes.
-- 3. Repeat with a stale expected_updated_at and verify *_VERSION_CONFLICT.
-- 4. SET LOCAL ROLE authenticated and verify permission denied for both RPCs.

-- Rollback (only after every deployed server stops referencing these RPCs):
-- drop function if exists public.save_meter_readings_with_audit(jsonb, uuid, text, uuid, uuid);
-- drop function if exists public.save_utility_usage_override_with_audit(uuid, jsonb, timestamptz, uuid, text, uuid, uuid);
