-- ZH-CTR-01: atomic contract renewal.
-- Manual Dashboard deployment. Run supabase/verification/contract_renewal_integrity.sql first and
-- stop if contracts_with_multiple_successors is not 0. Verify with
-- supabase/verification/atomic_contract_renewal.sql afterwards.
begin;

alter table public.contract_renewals add column operation_id uuid unique;

create unique index contracts_one_successor on public.contracts(previous_contract_id)
  where previous_contract_id is not null;

-- Receipts on a renewed contract are frozen. The key-share lock makes a receipt write wait for a
-- concurrent renewal (which holds the contract row FOR UPDATE) and then re-read the new status.
create or replace function public.contract_payments_renewed_lock() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.contracts where id = old.contract_id for key share;
    if v_status = 'renewed' then
      raise exception 'CONTRACT_RENEWED_RECEIPT_LOCKED' using errcode = '23514';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.contracts where id = new.contract_id for key share;
    if v_status = 'renewed' then
      raise exception 'CONTRACT_RENEWED_RECEIPT_LOCKED' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke all on function public.contract_payments_renewed_lock() from public, anon, authenticated;

-- Before-row triggers fire alphabetically; the 'a_' prefix makes this run before
-- 'contract_checkout_receipt_mutation'.
create trigger a_contract_payments_renewed_lock
  before insert or update or delete on public.contract_payments
  for each row execute function public.contract_payments_renewed_lock();

-- Checkout functions below are copied from 20261001143337_contract_checkout_settlement.sql and
-- 20261010140000_checkout_per_person_utilities.sql; only the marked statements changed.

-- Changed: the allocated-receipt check uses source.contract_id, because a transferred source keeps
-- its receipt on the previous contract.
create or replace function public.contract_checkout_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.contract_checkout_sources%rowtype;
begin
 if tg_op='INSERT' then
 if new.payment_type='deposit' then insert into public.contract_checkout_sources(contract_id,payment_id,source_type,approved_amount) values(new.contract_id,new.id,'deposit',new.amount); end if;
 return new;
 end if;
 select * into source from public.contract_checkout_sources where payment_id=old.id for update;
 if source.id is not null then
 if exists(select 1 from public.invoice_payments where checkout_source_id=source.id) or exists(select 1 from public.contract_checkout_refunds where source_id=source.id) or exists(select 1 from public.contract_checkout_statements s join public.contract_checkouts h on h.id=s.checkout_id where h.contract_id = source.contract_id) then raise exception 'CHECKOUT_RECEIPT_ALLOCATED'; end if;
 if tg_op='DELETE' then
 delete from public.contract_checkout_sources where id=source.id;
 return old;
 end if;
 if new.contract_id<>old.contract_id or new.payment_type<>old.payment_type or (source.source_type='credit' and new.amount<source.approved_amount) then raise exception 'CHECKOUT_SOURCE_RECEIPT_PROTECTED'; end if;
 if source.source_type='deposit' then update public.contract_checkout_sources set approved_amount=new.amount,updated_at=clock_timestamp() where id=source.id; end if;
 elsif tg_op='UPDATE' and new.payment_type='deposit' then insert into public.contract_checkout_sources(contract_id,payment_id,source_type,approved_amount) values(new.contract_id,new.id,'deposit',new.amount);
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

-- Changed: the receipt may belong to p_contract_id or to a renewed contract earlier in its chain.
create or replace function public.contract_checkout_credit(p_contract_id uuid,p_actor_id uuid,p_payment_id uuid,p_amount numeric,p_reason text,p_operation_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.contract_payments%rowtype; source public.contract_checkout_sources%rowtype;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 perform 1 from public.contracts where id=p_contract_id for update;
 select * into source from public.contract_checkout_sources where operation_id=p_operation_id;
 if found then if source.contract_id=p_contract_id and source.payment_id=p_payment_id and source.approved_amount=p_amount and source.reason=btrim(p_reason) and source.approved_by is not distinct from p_actor_id then return public.contract_checkout_get(p_contract_id); end if; raise exception 'CHECKOUT_OPERATION_CONFLICT'; end if;
 if not exists(select 1 from public.contract_checkouts where contract_id=p_contract_id and status='returned' and financial_mode='settlement') then raise exception 'CHECKOUT_PILOT_REQUIRED'; end if;
 if exists(select 1 from public.contract_checkout_statements s join public.contract_checkouts h on h.id=s.checkout_id where h.contract_id=p_contract_id) then raise exception 'CHECKOUT_ALREADY_CONFIRMED'; end if;
 select * into p from public.contract_payments pay
  where pay.id = p_payment_id
    and (pay.contract_id = p_contract_id or pay.contract_id in (
      with recursive chain(id, prev, depth) as (
        select c.id, c.previous_contract_id, 1 from public.contracts c where c.id = p_contract_id
        union all
        select c.id, c.previous_contract_id, chain.depth + 1
        from public.contracts c join chain on c.id = chain.prev
        where chain.depth < 20 and c.status = 'renewed'
      ) select id from chain where id <> p_contract_id))
  for update;
 if not found or p.payment_type not in ('other','prepaid_rent') or p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or p_amount>p.amount or exists(select 1 from public.contract_checkout_sources where payment_id=p.id) or length(btrim(coalesce(p_reason,'')))=0 then raise exception 'CHECKOUT_CREDIT_INVALID'; end if;
 insert into public.contract_checkout_sources(contract_id,payment_id,source_type,approved_amount,reason,operation_id,approved_by) values(p_contract_id,p.id,'credit',p_amount,btrim(p_reason),p_operation_id,p_actor_id);
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.credit_approved',p_operation_id,jsonb_build_object('paymentId',p.id,'amount',p_amount,'reason',p_reason));
 return public.contract_checkout_get(p_contract_id);
end $$;

-- Changed: 'sources' lists the sources owned by this contract (including transferred ones) plus its
-- own receipts that are not sources yet, each carrying the contract that holds the receipt.
create or replace function public.contract_checkout_get(p_contract_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; s public.contract_checkout_statements%rowtype; fb public.contract_checkout_final_bills%rowtype; b public.buildings%rowtype; d numeric; x numeric; refunded numeric; debt numeric; remaining numeric; statement jsonb:=null;
begin
 select * into h from public.contract_checkouts where contract_id=p_contract_id;
 -- Live building pricing, so the client can hide meter inputs before a draft snapshot exists.
 select bl.* into b from public.buildings bl join public.contracts ct on ct.building_id=bl.id where ct.id=p_contract_id;
 select coalesce(sum(public.contract_checkout_source_balance(id)) filter(where source_type='deposit'),0),coalesce(sum(public.contract_checkout_source_balance(id)) filter(where source_type='credit'),0) into d,x from public.contract_checkout_sources where contract_id=p_contract_id;
 select * into s from public.contract_checkout_statements where checkout_id=h.id;
 select * into fb from public.contract_checkout_final_bills where checkout_id=h.id;
 if s.id is not null then
 select coalesce(sum(amount),0) into refunded from public.contract_checkout_refunds where statement_id=s.id;
 select coalesce(sum(balance_amount),0) into debt from public.invoices where contract_id=p_contract_id and status<>'void';
 remaining:=greatest(d+x-debt,0);
 statement:=jsonb_build_object('id',s.id,'code',s.code,'confirmedAt',s.confirmed_at,'confirmedBy',s.confirmed_by,'preview',s.preview,'refundedAmount',refunded,'remainingRefund',remaining,'outstandingDebt',debt,'financialStatus',case when debt>0 then 'awaiting_payment' when remaining>0 then 'awaiting_refund' else 'settled' end);
 end if;
 return jsonb_build_object('checkout',case when h.id is null then null else jsonb_build_object('id',h.id,'contractId',h.contract_id,'buildingId',h.building_id,'actualReturnDate',h.actual_return_date,'reason',h.reason,'status',h.status,'financialMode',h.financial_mode,'pricingSnapshot',h.pricing_snapshot,'chargeModes',h.charge_modes,'electricity',h.electricity,'water',h.water,'updatedAt',h.updated_at) end,'depositHeld',d,'creditHeld',x,'statement',statement,'finalBill',case when fb.id is null then null else jsonb_build_object('id',fb.id,'issuedAt',fb.issued_at,'preview',fb.preview) end,
 'invoices',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',invoice_code,'dueDate',coalesce(due_date,h.actual_return_date),'balance',balance_amount) order by due_date nulls last,id),'[]') from public.invoices where contract_id=p_contract_id and status<>'void'),
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'paidAt',paid_at,'paymentMethod',payment_method,'note',note) order by created_at,id),'[]') from public.contract_checkout_refunds where statement_id=s.id),
 'sources',(select coalesce(jsonb_agg(src.j order by src.id),'[]') from (
   select p.id, jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',coalesce(cs.approved_amount,0),'originContractId',p.contract_id,'originContractCode',oc.contract_code) as j
   from public.contract_checkout_sources cs
   join public.contract_payments p on p.id = cs.payment_id
   join public.contracts oc on oc.id = p.contract_id
   where cs.contract_id = p_contract_id
   union all
   select p.id, jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',0,'originContractId',p.contract_id,'originContractCode',oc.contract_code)
   from public.contract_payments p
   join public.contracts oc on oc.id = p.contract_id
   where p.contract_id = p_contract_id
     and not exists (select 1 from public.contract_checkout_sources s2 where s2.payment_id = p.id)
 ) src),
 'buildingPricing',case when b.id is null then null else jsonb_build_object('electricityPricingType',b.electricity_pricing_type,'waterPricingType',b.water_pricing_type,'electricityRate',b.default_electricity_rate,'waterRate',b.default_water_rate) end);
end $$;

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
