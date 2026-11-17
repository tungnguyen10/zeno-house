-- Renewal as a new contract now carries the registered vehicles over.
-- Data impact: NONE to existing rows. Only renew_contract_atomic changes: in new_contract mode the
-- successor receives a copy of the old contract's contract_vehicles (extend mode keeps the same
-- contract, so its vehicles are untouched). Existing successors created before this change keep
-- their empty vehicle list; re-add the vehicles on them from the contract page if needed.
-- Execution model: apply manually in the Supabase Dashboard SQL Editor.
begin;

create or replace function public.renew_contract_atomic(
  p_contract_id uuid,
  p_mode text,
  p_new_end_date date,
  p_new_monthly_rent numeric,
  p_reason text,
  p_actor_id uuid,
  p_operation_id uuid,
  p_correlation_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_row public.contracts%rowtype;
  new_row public.contracts%rowtype;
  renewal public.contract_renewals%rowtype;
  before_row jsonb;
  v_rent numeric;
  v_closed_occ jsonb;
  v_sources jsonb := '[]'::jsonb;
  v_building_name text;
  v_building_code text;
  v_prefix text;
  v_seq integer;
  v_code text;
  v_cancel_reason text;
  am record;
begin
  if p_operation_id is null then
    raise exception 'RENEWAL_OPERATION_REQUIRED' using errcode = '22023';
  end if;

  -- Lock the contract before the replay lookup so a concurrent retry with the same operation id
  -- waits for the first call and then replays instead of failing with CONTRACT_NOT_ACTIVE.
  select * into old_row from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into renewal from public.contract_renewals where operation_id = p_operation_id;
  if found then
    if renewal.contract_id = p_contract_id and renewal.mode = p_mode
       and renewal.new_end_date = p_new_end_date
       and renewal.new_monthly_rent = coalesce(p_new_monthly_rent, renewal.old_monthly_rent) then
      return jsonb_build_object('renewal', to_jsonb(renewal), 'contract', to_jsonb(old_row),
        'new_contract', (select to_jsonb(c) from public.contracts c where c.id = renewal.new_contract_id),
        'transferred_source_ids', '[]'::jsonb, 'replayed', true);
    end if;
    raise exception 'RENEWAL_OPERATION_MISMATCH' using errcode = '23505';
  end if;

  if old_row.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE' using errcode = '23514'; end if;
  if exists (select 1 from public.contract_checkouts where contract_id = p_contract_id) then
    raise exception 'CONTRACT_CHECKOUT_IN_PROGRESS' using errcode = '23514';
  end if;
  if p_mode is null or p_mode not in ('extend', 'new_contract') or p_new_end_date is null
     or (p_new_monthly_rent is not null and (p_new_monthly_rent < 0 or p_new_monthly_rent <> trunc(p_new_monthly_rent) or p_new_monthly_rent > 999999999999))
     or (p_mode = 'new_contract' and p_new_monthly_rent is null) then
    raise exception 'RENEWAL_END_DATE_INVALID' using errcode = '22008';
  end if;
  v_rent := coalesce(p_new_monthly_rent, old_row.monthly_rent);
  before_row := to_jsonb(old_row);

  select name, code into v_building_name, v_building_code
  from public.buildings where id = old_row.building_id;

  if p_mode = 'extend' then
    if p_new_end_date <= old_row.end_date then
      raise exception 'RENEWAL_END_DATE_INVALID' using errcode = '22008';
    end if;
    v_cancel_reason := 'Hợp đồng đã được gia hạn';

    -- Cancel first: the contract update below would otherwise fire enforce_contract_amendment_lifecycle,
    -- which cancels with its own random correlation id and no actor.
    for am in select * from public.contract_amendments where contract_id = old_row.id and status = 'scheduled' order by id for update loop
      update public.contract_amendments
        set status = 'cancelled', cancelled_by = p_actor_id,
            cancellation_reason = v_cancel_reason, cancelled_at = now()
        where id = am.id;
      insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
        action, entity_type, entity_id, correlation_id, before_data, after_data, metadata)
      values (old_row.building_id, v_building_name, v_building_code, p_actor_id,
        'contract.amendment.cancelled', 'contract_amendment', am.id, p_correlation_id,
        am.before_terms, am.after_terms,
        jsonb_build_object('contract_id', old_row.id, 'reason', v_cancel_reason));
    end loop;

    update public.contracts
      set end_date = p_new_end_date,
          monthly_rent = v_rent,
          original_end_date = coalesce(original_end_date, old_row.end_date),
          renewal_count = renewal_count + 1
      where id = old_row.id
      returning * into new_row;

    insert into public.contract_renewals (contract_id, new_contract_id, mode, old_end_date, new_end_date,
      old_monthly_rent, new_monthly_rent, reason, created_by, operation_id)
    values (old_row.id, null, 'extend', old_row.end_date, p_new_end_date,
      old_row.monthly_rent, v_rent, nullif(btrim(p_reason), ''), p_actor_id, p_operation_id)
    returning * into renewal;

    insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
      action, entity_type, entity_id, correlation_id, before_data, after_data, metadata)
    values (old_row.building_id, v_building_name, v_building_code, p_actor_id,
      'contract.renewed', 'contract', old_row.id, p_correlation_id, before_row, to_jsonb(new_row),
      jsonb_build_object('mode', 'extend', 'renewal_id', renewal.id,
        'new_end_date', p_new_end_date, 'new_monthly_rent', v_rent));

    return jsonb_build_object('renewal', to_jsonb(renewal), 'contract', to_jsonb(new_row),
      'new_contract', null, 'transferred_source_ids', '[]'::jsonb, 'replayed', false);
  end if;

  -- new_contract
  if p_new_end_date <= old_row.end_date + 1 then
    raise exception 'RENEWAL_END_DATE_INVALID' using errcode = '22008';
  end if;
  v_cancel_reason := 'Hợp đồng đã được gia hạn thành hợp đồng mới';

  -- Lock order: contract (above), building advisory lock, room, open occupants by id, checkout sources by id.
  -- The advisory lock comes first to match create_contract_with_handover and avoid a lock-order deadlock.
  perform pg_advisory_xact_lock(hashtextextended(old_row.building_id::text, 1));
  perform 1 from public.rooms where id = old_row.room_id for update;
  perform 1 from public.contract_occupants where contract_id = old_row.id and move_out_date is null order by id for update;
  perform 1 from public.contract_checkout_sources where contract_id = old_row.id order by id for update;

  if exists (select 1 from public.contracts where previous_contract_id = old_row.id) then
    raise exception 'CONTRACT_ALREADY_RENEWED' using errcode = '23505';
  end if;

  select jsonb_agg(jsonb_build_object('tenant_id', o.tenant_id, 'role', o.role, 'billing_counted', o.billing_counted) order by o.id)
    into v_closed_occ
    from public.contract_occupants o
    where o.contract_id = old_row.id and o.move_out_date is null;
  if v_closed_occ is null then
    -- Legacy contracts can have no occupant rows. The contract tenant is then the primary occupant,
    -- unless that tenant already lives on another contract (one open occupancy per tenant).
    if exists (select 1 from public.contract_occupants where tenant_id = old_row.tenant_id and move_out_date is null) then
      raise exception 'RENEWAL_OCCUPANTS_MISSING' using errcode = '23514';
    end if;
    v_closed_occ := jsonb_build_array(jsonb_build_object(
      'tenant_id', old_row.tenant_id, 'role', 'primary', 'billing_counted', true));
  end if;

  -- Cancel first for the same reason as in the extend branch (status change fires the lifecycle trigger).
  for am in select * from public.contract_amendments where contract_id = old_row.id and status = 'scheduled' order by id for update loop
    update public.contract_amendments
      set status = 'cancelled', cancelled_by = p_actor_id,
          cancellation_reason = v_cancel_reason, cancelled_at = now()
      where id = am.id;
    insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
      action, entity_type, entity_id, correlation_id, before_data, after_data, metadata)
    values (old_row.building_id, v_building_name, v_building_code, p_actor_id,
      'contract.amendment.cancelled', 'contract_amendment', am.id, p_correlation_id,
      am.before_terms, am.after_terms,
      jsonb_build_object('contract_id', old_row.id, 'reason', v_cancel_reason));
  end loop;

  update public.contract_occupants set move_out_date = old_row.end_date
    where contract_id = old_row.id and move_out_date is null;

  update public.contracts set status = 'renewed' where id = old_row.id
    returning * into old_row;

  -- contract_code allocation is already serialized per building by the advisory lock taken above.
  v_prefix := format('hd-%s-%s', v_building_code, extract(year from old_row.end_date + 1)::integer);
  select coalesce(max(
    nullif(regexp_replace(contract_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
    into v_seq
    from public.contracts
   where contract_code like v_prefix || '-%';
  v_code := v_prefix || '-' || lpad(v_seq::text, 4, '0');

  insert into public.contracts (
    contract_code, room_id, tenant_id, building_id, start_date, end_date,
    monthly_rent, deposit, payment_due_day, occupant_count, discount_amount,
    surcharge_amount, status, notes, previous_contract_id, renewal_count, original_end_date
  ) values (
    v_code, old_row.room_id, old_row.tenant_id, old_row.building_id, old_row.end_date + 1, p_new_end_date,
    v_rent, old_row.deposit, old_row.payment_due_day, old_row.occupant_count, old_row.discount_amount,
    old_row.surcharge_amount, 'active', old_row.notes, old_row.id, old_row.renewal_count + 1,
    coalesce(old_row.original_end_date, old_row.end_date)
  ) returning * into new_row;

  insert into public.contract_occupants (contract_id, tenant_id, role, billing_counted, move_in_date)
  select new_row.id, o.tenant_id, o.role, o.billing_counted, old_row.end_date + 1
  from jsonb_to_recordset(v_closed_occ) as o(tenant_id uuid, role text, billing_counted boolean);

  insert into public.contract_services (contract_id, catalog_id, amount, quantity, is_enabled, notes)
  select new_row.id, cs.catalog_id, cs.amount, cs.quantity, cs.is_enabled, cs.notes
  from public.contract_services cs
  where cs.contract_id = old_row.id;

  insert into public.contract_vehicles (contract_id, owner_name, plate_number, vehicle_type, note, sort_order)
  select new_row.id, v.owner_name, v.plate_number, v.vehicle_type, v.note, v.sort_order
  from public.contract_vehicles v
  where v.contract_id = old_row.id;

  with moved as (
    update public.contract_checkout_sources s
       set contract_id = new_row.id, updated_at = clock_timestamp()
     where s.contract_id = old_row.id and public.contract_checkout_source_balance(s.id) > 0
     returning s.id, s.source_type, public.contract_checkout_source_balance(s.id) as balance
  ) select coalesce(jsonb_agg(jsonb_build_object('id', id, 'source_type', source_type, 'balance', balance)), '[]'::jsonb)
    into v_sources from moved;

  insert into public.contract_renewals (contract_id, new_contract_id, mode, old_end_date, new_end_date,
    old_monthly_rent, new_monthly_rent, reason, created_by, operation_id)
  values (old_row.id, new_row.id, 'new_contract', old_row.end_date, p_new_end_date,
    old_row.monthly_rent, v_rent, nullif(btrim(p_reason), ''), p_actor_id, p_operation_id)
  returning * into renewal;

  insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, before_data, after_data, metadata)
  values (old_row.building_id, v_building_name, v_building_code, p_actor_id,
    'contract.renewed', 'contract', old_row.id, p_correlation_id, before_row, to_jsonb(old_row),
    jsonb_build_object('mode', 'new_contract', 'renewal_id', renewal.id, 'new_contract_id', new_row.id,
      'new_end_date', p_new_end_date, 'new_monthly_rent', v_rent));

  insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, correlation_id, after_data, metadata)
  values (new_row.building_id, v_building_name, v_building_code, p_actor_id,
    'contract.created', 'contract', new_row.id, p_correlation_id, to_jsonb(new_row),
    jsonb_build_object('source', 'renewal', 'renewal_id', renewal.id, 'previous_contract_id', old_row.id));

  if jsonb_array_length(v_sources) > 0 then
    insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
      action, entity_type, entity_id, correlation_id, metadata)
    values (new_row.building_id, v_building_name, v_building_code, p_actor_id,
      'contract.checkout_source.transferred', 'contract', new_row.id, p_correlation_id,
      jsonb_build_object('from_contract_id', old_row.id, 'renewal_id', renewal.id, 'sources', v_sources));
  end if;

  return jsonb_build_object('renewal', to_jsonb(renewal), 'contract', to_jsonb(old_row),
    'new_contract', to_jsonb(new_row),
    'transferred_source_ids', (select coalesce(jsonb_agg(e -> 'id'), '[]'::jsonb) from jsonb_array_elements(v_sources) e),
    'replayed', false);
end;
$$;

revoke all on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
