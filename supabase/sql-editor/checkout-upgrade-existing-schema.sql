-- SQL Editor upgrade for a staging database that already has the original checkout migration.
-- Do not use on a database without the original checkout schema.
-- Existing returned records are marked legacy and left financially unchanged.
begin;
do $$
begin
  if to_regclass('public.contract_checkouts') is null
    or to_regclass('public.contract_checkout_sources') is null
    or to_regclass('public.contract_checkout_statements') is null
    or to_regclass('public.contract_checkout_refunds') is null
    or to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz)') is null
  then raise exception 'CHECKOUT_OLD_SCHEMA_REQUIRED'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='contract_checkouts' and column_name='pricing_snapshot')
    or to_regclass('public.contract_checkout_final_bills') is not null
  then raise exception 'CHECKOUT_UPGRADE_ALREADY_STARTED'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.contract_checkouts'::regclass and tgname='checkout_record_history' and not tgisinternal)
  then raise exception 'CHECKOUT_OLD_GUARD_REQUIRED'; end if;
end $$;

alter table public.contract_checkouts
  add column pricing_snapshot jsonb,
  add column charge_modes jsonb not null default '{}'::jsonb,
  add column financial_mode text not null default 'standard' check(financial_mode in ('standard','settlement','legacy'));
-- The old immutable-history trigger disallows even a classification update.
-- Recreate that one trigger in this transaction after marking old returns.
drop trigger checkout_record_history on public.contract_checkouts;
update public.contract_checkouts set financial_mode='legacy' where status='returned';
create trigger checkout_record_history before update or delete on public.contract_checkouts for each row execute function public.contract_checkout_record_guard();
create table public.contract_checkout_final_bills (
 id uuid primary key default gen_random_uuid(), checkout_id uuid not null unique references public.contract_checkouts(id) on delete restrict,
 operation_id uuid not null unique, snapshot_hash text not null, preview jsonb not null,
 issued_by uuid references auth.users(id) on delete set null, issued_at timestamptz not null default now()
);

create or replace function public.contract_checkout_preview(p_contract_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.contracts%rowtype; h public.contract_checkouts%rowtype; b public.buildings%rowtype;
 d numeric:=0; x numeric:=0; n numeric:=0; f numeric:=0; cash_collected numeric:=0; base numeric; rate numeric; usage numeric; amount numeric;
 meter text; input jsonb; charges jsonb:='[]'; billed_charges jsonb:='[]'; waived_charges jsonb:='[]'; debts jsonb:='[]'; blockers jsonb:='[]'; snapshot jsonb; item record; target uuid;
 first_day date; billable_days integer; period_days integer; price numeric; quantity numeric; mode text; mode_reason text; charge_key text; v_charge_type text; v_source_type text; v_source_id uuid; charge_label text; charge_metadata jsonb; rent_billed boolean;
begin
 select * into c from public.contracts where id=p_contract_id;
 if not found then raise exception 'CHECKOUT_CONTRACT_NOT_FOUND'; end if;
 select * into h from public.contract_checkouts where contract_id=c.id;
 select * into b from public.buildings where id=c.building_id;
 if h.id is null then blockers:=blockers||jsonb_build_array('CHECKOUT_DRAFT_REQUIRED'); end if;
 if h.financial_mode='legacy' then blockers:=blockers||jsonb_build_array('CHECKOUT_LEGACY_RETURN'); end if;
 if h.pricing_snapshot->'building'->>'electricityPricingType'='tiered' then blockers:=blockers||jsonb_build_array('CHECKOUT_TIERED_UNSUPPORTED'); end if;
 select coalesce(sum(public.contract_checkout_source_balance(s.id)) filter(where source_type='deposit'),0),coalesce(sum(public.contract_checkout_source_balance(s.id)) filter(where source_type='credit'),0) into d,x from public.contract_checkout_sources s where contract_id=c.id;
 select coalesce(sum(balance_amount),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'code',invoice_code,'dueDate',coalesce(due_date,c.end_date),'balance',balance_amount) order by due_date nulls last,id),'[]') into n,debts from public.invoices where contract_id=c.id and status<>'void' and balance_amount>0;
 select coalesce(sum(p.amount),0) into cash_collected from public.invoice_payments p join public.invoices i on i.id=p.invoice_id where i.contract_id=c.id and i.status<>'void' and p.deleted_at is null and p.funding_source='cash';
 if exists(select 1 from public.invoices i where i.contract_id=c.id and i.status<>'void' and (i.paid_amount is distinct from coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id=i.id and p.deleted_at is null),0) or i.balance_amount is distinct from i.total_amount-i.paid_amount)) then blockers:=blockers||jsonb_build_array('CHECKOUT_INVOICE_TOTALS_INCONSISTENT'); end if;
 select id into target from public.billing_periods where building_id=c.building_id and period_year=extract(year from h.actual_return_date) and period_month=extract(month from h.actual_return_date);
 if exists(select 1 from public.billing_periods p where p.status='closed' and (p.id=target or exists(select 1 from public.billing_incidental_charges a where a.billing_period_id=p.id and a.contract_id=c.id and a.deleted_at is null and not exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.status<>'void' and q.source_id=a.id and q.charge_type='incidental')))) then blockers:=blockers||jsonb_build_array('CHECKOUT_PERIOD_CLOSED'); end if;
 if h.status='returned' then
   first_day:=date_trunc('month',h.actual_return_date)::date;
   period_days:=(first_day+interval '1 month')::date-first_day;
   billable_days:=greatest(0,h.actual_return_date-greatest(first_day,(h.pricing_snapshot->>'startDate')::date)+1);
   for item in
     select 'rent'::text as key,'rent'::text as kind,'Tiền phòng'::text as label,(h.pricing_snapshot->>'monthlyRent')::numeric as unit_price,1::numeric as qty,'contract'::text as source_kind,c.id as source_uuid
     union all select 'electricity_fixed','electricity','Tiền điện',(h.pricing_snapshot->'building'->>'electricityRate')::numeric,case when h.pricing_snapshot->'building'->>'electricityPricingType'='per_person' then (h.pricing_snapshot->>'occupantCount')::numeric else 1::numeric end,'building',c.building_id where h.pricing_snapshot->'building'->>'electricityPricingType' in ('fixed','per_person')
     union all select 'water_fixed','water','Tiền nước',(h.pricing_snapshot->'building'->>'waterRate')::numeric,case when h.pricing_snapshot->'building'->>'waterPricingType'='per_person' then (h.pricing_snapshot->>'occupantCount')::numeric else 1::numeric end,'building',c.building_id where h.pricing_snapshot->'building'->>'waterPricingType' in ('fixed_per_room','per_person')
     union all select 'service:'||(s.value->>'id'),'service',s.value->>'label',(s.value->>'amount')::numeric,(s.value->>'quantity')::numeric,'contract_service',(s.value->>'id')::uuid from jsonb_array_elements(coalesce(h.pricing_snapshot->'services','[]'::jsonb)) s
   loop
     charge_key:=item.key; v_charge_type:=item.kind; charge_label:=item.label; price:=item.unit_price; quantity:=item.qty; v_source_type:=item.source_kind; v_source_id:=item.source_uuid;
     if price is null or price<0 then blockers:=blockers||jsonb_build_array('CHECKOUT_RATE_REQUIRED'); continue; end if;
     if exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=c.id and i.status<>'void' and i.billing_period_id=target and q.charge_type=v_charge_type and q.source_type=v_source_type and q.source_id=v_source_id) then
       continue;
     end if;
     mode:=coalesce(h.charge_modes->charge_key->>'mode','prorated'); mode_reason:=h.charge_modes->charge_key->>'reason';
     if mode='waived' then waived_charges:=waived_charges||jsonb_build_array(jsonb_build_object('key',charge_key,'label',charge_label,'reason',mode_reason)); continue; end if;
     if mode not in ('prorated','full_month') then blockers:=blockers||jsonb_build_array('CHECKOUT_CHARGE_MODE_INVALID'); continue; end if;
     amount:=ceil(round(price*quantity*case when mode='full_month' then 1 else billable_days::numeric/period_days end)/1000)*1000;
     if amount>0 then
       charge_metadata:=jsonb_build_object('checkout_id',h.id,'checkout_charge_key',charge_key,'billing_period_id',target,'billable_days',billable_days,'period_days',period_days,'charge_mode',mode,'mode_reason',mode_reason);
       charges:=charges||jsonb_build_array(jsonb_build_object('key',charge_key,'chargeType',v_charge_type,'label',charge_label,'amount',amount,'quantity',quantity,'unitPrice',price,'sourceType',v_source_type,'sourceId',v_source_id,'metadata',charge_metadata)); f:=f+amount;
     end if;
   end loop;
   select exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=c.id and i.status<>'void' and i.billing_period_id=target and q.charge_type='rent' and q.source_type='contract' and q.source_id=c.id) into rent_billed;
   mode:=coalesce(h.charge_modes->'rent'->>'mode','prorated');
   if mode<>'waived' then
     for item in select 'discount'::text as kind,'Giảm giá'::text as label,-1::numeric as sign,(h.pricing_snapshot->>'discountAmount')::numeric as base_amount
       union all select 'surcharge','Phụ thu',1::numeric,(h.pricing_snapshot->>'surchargeAmount')::numeric
     loop
       if item.base_amount<=0 or exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=c.id and i.status<>'void' and i.billing_period_id=target and q.charge_type=item.kind and q.source_type='contract' and q.source_id=c.id) then continue; end if;
       if item.kind='discount' and rent_billed then blockers:=blockers||jsonb_build_array('CHECKOUT_DISCOUNT_REQUIRES_CORRECTION'); continue; end if;
       amount:=item.sign*ceil(round(item.base_amount*case when mode='full_month' then 1 else billable_days::numeric/period_days end)/1000)*1000;
       charges:=charges||jsonb_build_array(jsonb_build_object('key',item.kind,'chargeType',item.kind,'label',item.label,'amount',amount,'quantity',1,'unitPrice',item.sign*item.base_amount,'sourceType','contract','sourceId',c.id,'metadata',jsonb_build_object('checkout_id',h.id,'checkout_charge_key',item.kind,'billing_period_id',target,'charge_mode',mode)));
       f:=f+amount;
     end loop;
   end if;
 end if;
 foreach meter in array array['electricity','water'] loop
 input:=case when meter='electricity' then h.electricity else h.water end;
 if (meter='electricity' and h.pricing_snapshot->'building'->>'electricityPricingType' is distinct from 'per_kwh') or (meter='water' and h.pricing_snapshot->'building'->>'waterPricingType' is distinct from 'per_m3') then continue; end if;
 if input is null or input='null'::jsonb then blockers:=blockers||jsonb_build_array('CHECKOUT_'||upper(meter)||'_READING_REQUIRED'); continue; end if;
 base:=null;
 select (q.metadata->>'current_reading_value')::numeric into base from public.invoice_charges q join public.invoices i on i.id=q.invoice_id join public.billing_periods p on p.id=i.billing_period_id where i.contract_id=c.id and i.status<>'void' and q.charge_type=meter and q.metadata->>'current_reading_value' is not null order by p.period_year desc,p.period_month desc,q.created_at desc,q.id desc limit 1;
 if base is null then select reading_value into base from public.meter_readings where contract_id=c.id and meter_type=meter and reading_type='handover_in'; end if;
 if base is null then blockers:=blockers||jsonb_build_array('CHECKOUT_'||upper(meter)||'_BASELINE_REQUIRED'); continue; end if;
 rate:=case when meter='electricity' then (h.pricing_snapshot->'building'->>'electricityRate')::numeric else (h.pricing_snapshot->'building'->>'waterRate')::numeric end;
 if rate is null or rate<0 then blockers:=blockers||jsonb_build_array('CHECKOUT_RATE_REQUIRED'); continue; end if;
 usage:=coalesce((input->>'usageOverride')::numeric,(input->>'reading')::numeric-base);
 if usage<0 or (input->>'usageOverride' is not null and length(btrim(coalesce(input->>'reason','')))=0) then blockers:=blockers||jsonb_build_array('CHECKOUT_USAGE_INVALID'); continue; end if;
 amount:=ceil(round(usage*rate)/1000)*1000;
 if amount>0 and not exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=c.id and i.status<>'void' and q.metadata->>'checkout_charge_key'=meter and q.metadata->>'checkout_id'=h.id::text) then charges:=charges||jsonb_build_array(jsonb_build_object('key',meter,'chargeType',meter,'label',case when meter='electricity' then 'Điện chốt' else 'Nước chốt' end,'amount',amount,'quantity',usage,'unitPrice',rate,'sourceType','contract_checkout','sourceId',h.id,'metadata',jsonb_build_object('checkout_charge_key',meter,'previous_reading_value',base,'current_reading_value',(input->>'reading')::numeric,'billable_usage',usage,'reason',input->>'reason','checkout_id',h.id,'billing_period_id',target))); f:=f+amount; end if;
 end loop;
 for item in select a.* from public.billing_incidental_charges a where a.contract_id=c.id and deleted_at is null and not exists(select 1 from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.status<>'void' and q.source_id=a.id and q.charge_type='incidental') order by a.billing_period_id,a.id loop
 charges:=charges||jsonb_build_array(jsonb_build_object('key',item.id,'chargeType','incidental','label',item.label,'amount',item.amount,'quantity',1,'unitPrice',item.amount,'sourceType','billing_incidental_charge','sourceId',item.id,'metadata',jsonb_build_object('source_id',item.id,'billing_period_id',item.billing_period_id,'checkout_id',h.id))); f:=f+item.amount;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('key',q.id,'label',q.label,'amount',q.amount,'invoiceId',i.id) order by q.sort_order,q.id),'[]'::jsonb) into billed_charges from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=c.id and i.billing_period_id=target and i.status<>'void';
 if f<0 or n+f<0 then blockers:=blockers||jsonb_build_array('CHECKOUT_NEGATIVE_FINAL_TOTAL'); end if;
 -- Hash all financial source versions, including changed cash receipts and zero-balance invoices.
 snapshot:=jsonb_build_object('contract',to_jsonb(c),'checkout',to_jsonb(h),'building',to_jsonb(b),'charges',charges,
 'invoices',(select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]') from public.invoices i where contract_id=c.id),
 'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.invoice_payments p join public.invoices i on i.id=p.invoice_id where i.contract_id=c.id),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.contract_payments p where contract_id=c.id),
 'sources',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.contract_checkout_sources s where contract_id=c.id),
 'periods',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.billing_periods p where building_id=c.building_id),
 'meterReadings',(select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.meter_readings m where contract_id=c.id),
 'incidental',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.billing_incidental_charges a where contract_id=c.id));
 return jsonb_build_object('snapshotHash',md5(snapshot::text),'depositHeld',d,'creditHeld',x,'cashCollected',cash_collected,'existingDebt',n,'finalChargesTotal',f,'totalDue',n+f,'refundDue',greatest(d+x-n-f,0),'additionalDue',greatest(n+f-d-x,0),'creditApplied',least(x,n+f),'depositApplied',least(d,greatest(n+f-x,0)),'charges',charges,'billedCharges',billed_charges,'waivedCharges',waived_charges,'invoices',debts,'blockers',blockers);
end $$;

create or replace function public.contract_checkout_get(p_contract_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; s public.contract_checkout_statements%rowtype; fb public.contract_checkout_final_bills%rowtype; d numeric; x numeric; refunded numeric; debt numeric; remaining numeric; statement jsonb:=null;
begin
 select * into h from public.contract_checkouts where contract_id=p_contract_id;
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
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',coalesce(cs.approved_amount,0)) order by p.id),'[]') from public.contract_payments p left join public.contract_checkout_sources cs on p.id=cs.payment_id where p.contract_id=p_contract_id));
end $$;

create or replace function public.contract_checkout_audit(p_contract_id uuid,p_actor_id uuid,p_action text,p_operation_id uuid,p_data jsonb) returns void language sql security invoker set search_path='' as $$
 insert into public.audit_events(building_id,actor_id,action,entity_type,entity_id,correlation_id,operation_id,after_data) select building_id,p_actor_id,p_action,'contract',id,p_operation_id,p_operation_id,p_data from public.contracts where id=p_contract_id
$$;

drop function public.contract_checkout_return(uuid,uuid,uuid,timestamptz);
create function public.contract_checkout_return(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_expected_updated_at timestamptz,p_financial_mode text default 'standard') returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; c public.contracts%rowtype; b public.buildings%rowtype; meter text; input jsonb; baseline numeric; pricing text; room_before jsonb;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 select * into c from public.contracts where id=p_contract_id for update;
 select * into h from public.contract_checkouts where contract_id=p_contract_id for update;
 if h.id is null then raise exception 'CHECKOUT_DRAFT_REQUIRED'; end if;
 if h.returned_operation_id=p_operation_id and h.returned_by is not distinct from p_actor_id then return public.contract_checkout_get(p_contract_id); end if;
 if h.status<>'draft' or h.updated_at is distinct from p_expected_updated_at then raise exception 'CHECKOUT_VERSION_CONFLICT'; end if;
 if c.status not in ('active','expired') or p_financial_mode is null or p_financial_mode not in ('standard','settlement') then raise exception 'CHECKOUT_STATE_INVALID'; end if;
 select * into b from public.buildings where id=c.building_id for share;
 foreach meter in array array['electricity','water'] loop
 input:=case when meter='electricity' then h.electricity else h.water end;
 pricing:=case when meter='electricity' then b.electricity_pricing_type else b.water_pricing_type end;
 if pricing in ('per_kwh','per_m3','tiered') then
   if input is null or input='null'::jsonb or input->>'reading' is null then raise exception 'CHECKOUT_READING_REQUIRED'; end if;
   select (q.metadata->>'current_reading_value')::numeric into baseline from public.invoice_charges q join public.invoices i on i.id=q.invoice_id join public.billing_periods p on p.id=i.billing_period_id where i.contract_id=c.id and i.status<>'void' and q.charge_type=meter and q.metadata->>'current_reading_value' is not null order by p.period_year desc,p.period_month desc,q.created_at desc,q.id desc limit 1;
   if baseline is null then select reading_value into baseline from public.meter_readings where contract_id=c.id and meter_type=meter and reading_type='handover_in'; end if;
   if baseline is null then raise exception 'CHECKOUT_BASELINE_REQUIRED'; end if;
   if (input->>'reading')::numeric<baseline then raise exception 'CHECKOUT_READING_BELOW_BASELINE'; end if;
 end if;
 if input is not null and input<>'null'::jsonb then
   if exists(select 1 from public.meter_readings m where m.contract_id=c.id and m.meter_type=meter and m.reading_type='handover_out') then
     if not exists(select 1 from public.meter_readings m where m.contract_id=c.id and m.meter_type=meter and m.reading_type='handover_out' and m.reading_date=h.actual_return_date and m.reading_value=(input->>'reading')::numeric) then raise exception 'CHECKOUT_READING_CONFLICT'; end if;
   else
     insert into public.meter_readings(room_id,building_id,contract_id,meter_type,reading_type,period_year,period_month,reading_date,reading_value,recorded_by) values(c.room_id,c.building_id,c.id,meter,'handover_out',extract(year from h.actual_return_date),extract(month from h.actual_return_date),h.actual_return_date,(input->>'reading')::numeric,p_actor_id);
   end if;
 end if;
 end loop;
 update public.contract_checkouts set pricing_snapshot=jsonb_build_object('monthlyRent',c.monthly_rent,'discountAmount',c.discount_amount,'surchargeAmount',c.surcharge_amount,'occupantCount',c.occupant_count,'startDate',c.start_date,'building',jsonb_build_object('electricityPricingType',b.electricity_pricing_type,'waterPricingType',b.water_pricing_type,'electricityRate',b.default_electricity_rate,'waterRate',b.default_water_rate),'services',(select coalesce(jsonb_agg(jsonb_build_object('id',cs.id,'catalogId',cs.catalog_id,'label',sc.name,'pricingType',sc.pricing_type,'amount',cs.amount,'quantity',cs.quantity) order by cs.id),'[]'::jsonb) from public.contract_services cs join public.service_catalog sc on sc.id=cs.catalog_id where cs.contract_id=c.id and cs.is_enabled)),financial_mode=p_financial_mode,updated_at=clock_timestamp() where id=h.id;
 -- Contract guard permits only the nested audited return RPC transition.
 perform set_config('zeno.checkout_return_contract',p_contract_id::text,true);
 update public.contract_checkouts set status='returned',returned_operation_id=p_operation_id,returned_by=p_actor_id,updated_at=clock_timestamp() where id=h.id;
 perform set_config('zeno.checkout_return_contract',p_contract_id::text,true);
 update public.contracts set status='terminated' where id=p_contract_id;
 perform set_config('zeno.checkout_return_contract','',true);
 update public.contract_occupants set move_out_date=h.actual_return_date where contract_id=p_contract_id and move_out_date is null;
 select to_jsonb(r) into room_before from public.rooms r where r.id=c.room_id for update;
 update public.rooms set status='available' where id=c.room_id and status='occupied' and not exists(select 1 from public.contracts next_contract where next_contract.room_id=c.room_id and next_contract.id<>c.id and next_contract.status='active');
 insert into public.audit_events(building_id,actor_id,action,entity_type,entity_id,correlation_id,before_data,after_data) select c.building_id,p_actor_id,'room.updated','room',c.room_id,p_operation_id,room_before,to_jsonb(r) from public.rooms r where r.id=c.room_id and room_before is distinct from to_jsonb(r);
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.returned',p_operation_id,jsonb_build_object('actualReturnDate',h.actual_return_date));
 return public.contract_checkout_get(p_contract_id);
end $$;

create function public.contract_checkout_save_charge_modes(p_contract_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,p_modes jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; entry record; choice text; reason text; service_id text;
begin
 perform 1 from public.contracts where id=p_contract_id for update;
 select * into h from public.contract_checkouts where contract_id=p_contract_id for update;
 if h.id is null or h.status<>'returned' then raise exception 'CHECKOUT_RETURN_REQUIRED'; end if;
 if h.financial_mode='legacy' then raise exception 'CHECKOUT_LEGACY_RETURN'; end if;
 if h.updated_at is distinct from p_expected_updated_at then raise exception 'CHECKOUT_VERSION_CONFLICT'; end if;
 if exists(select 1 from public.contract_checkout_statements where checkout_id=h.id) or exists(select 1 from public.contract_checkout_final_bills where checkout_id=h.id) then raise exception 'CHECKOUT_ALREADY_ISSUED'; end if;
 if jsonb_typeof(p_modes) is distinct from 'object' then raise exception 'CHECKOUT_CHARGE_MODE_INVALID'; end if;
 for entry in select key,value from jsonb_each(p_modes) loop
   if entry.key not in ('rent','electricity_fixed','water_fixed') then
     if left(entry.key,8)<>'service:' then raise exception 'CHECKOUT_CHARGE_MODE_INVALID'; end if;
     service_id:=substring(entry.key from 9);
     if not exists(select 1 from jsonb_array_elements(coalesce(h.pricing_snapshot->'services','[]'::jsonb)) s where s.value->>'id'=service_id) then raise exception 'CHECKOUT_CHARGE_MODE_INVALID'; end if;
   elsif entry.key='electricity_fixed' and h.pricing_snapshot->'building'->>'electricityPricingType' not in ('fixed','per_person') then raise exception 'CHECKOUT_CHARGE_MODE_INVALID';
   elsif entry.key='water_fixed' and h.pricing_snapshot->'building'->>'waterPricingType' not in ('fixed_per_room','per_person') then raise exception 'CHECKOUT_CHARGE_MODE_INVALID';
   end if;
   choice:=entry.value->>'mode'; reason:=btrim(coalesce(entry.value->>'reason',''));
   if jsonb_typeof(entry.value) is distinct from 'object' or choice is null or choice not in ('prorated','full_month','waived') or (choice='waived' and length(reason) not between 1 and 500) then raise exception 'CHECKOUT_CHARGE_MODE_INVALID'; end if;
 end loop;
 perform set_config('zeno.checkout_charge_modes',h.id::text,true);
 update public.contract_checkouts set charge_modes=p_modes,updated_at=clock_timestamp() where id=h.id;
 perform set_config('zeno.checkout_charge_modes','',true);
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.charge_modes_saved',null,p_modes);
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_confirm(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_snapshot_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.contracts%rowtype; h public.contract_checkouts%rowtype; s public.contract_checkout_statements%rowtype; preview jsonb;
 target uuid; invoice uuid; charge jsonb; item record; source record; take numeric; available numeric; balance numeric;
begin
 if p_operation_id is null or p_snapshot_hash is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 select * into c from public.contracts where id=p_contract_id for update;
 if not found then raise exception 'CHECKOUT_CONTRACT_NOT_FOUND'; end if;
 select * into h from public.contract_checkouts where contract_id=c.id for update;
 select * into s from public.contract_checkout_statements where checkout_id=h.id;
 if s.id is not null then
 if s.operation_id=p_operation_id and s.snapshot_hash=p_snapshot_hash and s.confirmed_by is not distinct from p_actor_id then return public.contract_checkout_get(c.id); end if;
 raise exception 'CHECKOUT_ALREADY_CONFIRMED'; end if;
 if h.status is distinct from 'returned' then raise exception 'CHECKOUT_RETURN_REQUIRED'; end if;
 if h.financial_mode<>'settlement' then raise exception 'CHECKOUT_PILOT_REQUIRED'; end if;
 -- Stable lock order; lock source receipts too, so edits cannot change an approved balance.
 perform 1 from public.contract_payments where contract_id=c.id order by id for update;
 perform 1 from public.contract_checkout_sources where contract_id=c.id order by id for update;
 perform 1 from public.buildings where id=c.building_id for share;
 perform 1 from public.meter_readings where contract_id=c.id order by id for update;
 -- Lock existing building periods before creating the target, preserving period writers' order.
 perform 1 from public.billing_periods where building_id=c.building_id order by id for update;
 perform 1 from public.billing_incidental_charges where contract_id=c.id order by id for update;
 perform 1 from public.invoices where contract_id=c.id order by id for update;
 perform 1 from public.invoice_charges q where q.invoice_id in(select id from public.invoices where contract_id=c.id) order by id for update;
 perform 1 from public.invoice_payments q where q.invoice_id in(select id from public.invoices where contract_id=c.id) order by id for update;
 preview:=public.contract_checkout_preview(c.id);
 if preview->>'snapshotHash' is distinct from p_snapshot_hash then raise exception 'CHECKOUT_SNAPSHOT_STALE'; end if;
 if jsonb_array_length(preview->'blockers')>0 then raise exception 'CHECKOUT_PREVIEW_BLOCKED'; end if;
 insert into public.contract_checkout_statements(checkout_id,operation_id,snapshot_hash,preview,code,confirmed_by) values(h.id,p_operation_id,p_snapshot_hash,preview,'SET-'||upper(substr(replace(h.id::text,'-',''),1,16)),p_actor_id) returning * into s;
 for charge in select value from jsonb_array_elements(preview->'charges') loop
 target:=nullif(charge->'metadata'->>'billing_period_id','')::uuid;
 if target is null then
 insert into public.billing_periods(building_id,period_year,period_month,opened_by) values(c.building_id,extract(year from h.actual_return_date),extract(month from h.actual_return_date),p_actor_id) on conflict(building_id,period_year,period_month) do nothing;
 select id into target from public.billing_periods where building_id=c.building_id and period_year=extract(year from h.actual_return_date) and period_month=extract(month from h.actual_return_date) for update;
 end if;
 if exists(select 1 from public.billing_periods where id=target and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 select id into invoice from public.invoices where billing_period_id=target and contract_id=c.id and status<>'void' for update;
 if invoice is null then insert into public.invoices(invoice_code,billing_period_id,contract_id,room_id,tenant_id,status,due_date,issued_at,notes) values('inv-checkout-'||replace(gen_random_uuid()::text,'-',''),target,c.id,c.room_id,c.tenant_id,'issued',h.actual_return_date,now(),'Final checkout charges only') returning id into invoice; end if;
 perform set_config('zeno.checkout_invoice_mutation',invoice::text,true);
 insert into public.invoice_charges(invoice_id,charge_type,label,source_type,source_id,quantity,unit_price,amount,metadata,sort_order) values(invoice,charge->>'chargeType',charge->>'label',charge->>'sourceType',(charge->>'sourceId')::uuid,(charge->>'quantity')::numeric,(charge->>'unitPrice')::numeric,(charge->>'amount')::numeric,charge->'metadata'||jsonb_build_object('statement_id',s.id,'billing_period_id',target,'contract_id',c.id,'room_id',c.room_id),100);
 update public.invoices set subtotal_amount=subtotal_amount+(charge->>'amount')::numeric,total_amount=total_amount+(charge->>'amount')::numeric,balance_amount=balance_amount+(charge->>'amount')::numeric,status=case when balance_amount+(charge->>'amount')::numeric=0 then 'paid' when paid_amount>0 then 'partial' else 'issued' end,paid_at=case when balance_amount+(charge->>'amount')::numeric=0 then paid_at else null end where id=invoice;
 perform set_config('zeno.checkout_invoice_mutation','',true);
 insert into public.billing_audit_events(billing_period_id,actor_id,action,entity_type,entity_id,after_data) values(target,p_actor_id,'invoice.checkout_charge.appended','invoice',invoice,charge);
 end loop;
 -- Source order X then D; invoice order oldest due, stable UUID tie break.
 for source in select * from public.contract_checkout_sources where contract_id=c.id order by case source_type when 'credit' then 0 else 1 end,created_at,id loop
 available:=public.contract_checkout_source_balance(source.id);
 for item in select i.* from public.invoices i where contract_id=c.id and status<>'void' and balance_amount>0 order by due_date nulls last,created_at,id loop
 exit when available<=0;
 take:=least(available,item.balance_amount);
 insert into public.invoice_payments(invoice_id,amount,paid_at,payment_method,note,recorded_by,funding_source,checkout_source_id,checkout_statement_id) values(item.id,take,h.actual_return_date,'checkout_allocation','Existing receipt allocation; no new cash received',p_actor_id,source.source_type,source.id,s.id);
 update public.invoices set paid_amount=paid_amount+take,balance_amount=balance_amount-take,status=case when balance_amount-take=0 then 'paid' else 'partial' end,paid_at=case when balance_amount-take=0 then now() else paid_at end where id=item.id;
 available:=available-take;
 end loop;
 end loop;
 perform public.contract_checkout_audit(c.id,p_actor_id,'contract.checkout.confirmed',p_operation_id,preview);
 return public.contract_checkout_get(c.id);
end $$;

create function public.contract_checkout_issue_final(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_snapshot_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.contracts%rowtype; h public.contract_checkouts%rowtype; fb public.contract_checkout_final_bills%rowtype; preview jsonb; charge jsonb; target uuid; invoice uuid;
begin
 if p_operation_id is null or p_snapshot_hash is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 select * into c from public.contracts where id=p_contract_id for update;
 if not found then raise exception 'CHECKOUT_CONTRACT_NOT_FOUND'; end if;
 select * into h from public.contract_checkouts where contract_id=c.id for update;
 select * into fb from public.contract_checkout_final_bills where checkout_id=h.id;
 if fb.id is not null then
   if fb.operation_id=p_operation_id and fb.snapshot_hash=p_snapshot_hash and fb.issued_by is not distinct from p_actor_id then return public.contract_checkout_get(c.id); end if;
   raise exception 'CHECKOUT_ALREADY_ISSUED';
 end if;
 if h.status<>'returned' or h.financial_mode<>'standard' then raise exception 'CHECKOUT_STANDARD_RETURN_REQUIRED'; end if;
 perform 1 from public.buildings where id=c.building_id for share;
 perform 1 from public.meter_readings where contract_id=c.id order by id for update;
 perform 1 from public.billing_periods where building_id=c.building_id order by id for update;
 perform 1 from public.billing_incidental_charges where contract_id=c.id order by id for update;
 perform 1 from public.invoices where contract_id=c.id order by id for update;
 perform 1 from public.invoice_charges q where q.invoice_id in(select id from public.invoices where contract_id=c.id) order by id for update;
 perform 1 from public.invoice_payments q where q.invoice_id in(select id from public.invoices where contract_id=c.id) order by id for update;
 preview:=public.contract_checkout_preview(c.id);
 if preview->>'snapshotHash' is distinct from p_snapshot_hash then raise exception 'CHECKOUT_SNAPSHOT_STALE'; end if;
 if jsonb_array_length(preview->'blockers')>0 then raise exception 'CHECKOUT_PREVIEW_BLOCKED'; end if;
 insert into public.contract_checkout_final_bills(checkout_id,operation_id,snapshot_hash,preview,issued_by) values(h.id,p_operation_id,p_snapshot_hash,preview,p_actor_id) returning * into fb;
 for charge in select value from jsonb_array_elements(preview->'charges') loop
   target:=nullif(charge->'metadata'->>'billing_period_id','')::uuid;
   if target is null then
     insert into public.billing_periods(building_id,period_year,period_month,opened_by) values(c.building_id,extract(year from h.actual_return_date),extract(month from h.actual_return_date),p_actor_id) on conflict(building_id,period_year,period_month) do nothing;
     select id into target from public.billing_periods where building_id=c.building_id and period_year=extract(year from h.actual_return_date) and period_month=extract(month from h.actual_return_date) for update;
   end if;
   if exists(select 1 from public.billing_periods where id=target and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
   select id into invoice from public.invoices where billing_period_id=target and contract_id=c.id and status<>'void' for update;
   if invoice is null then insert into public.invoices(invoice_code,billing_period_id,contract_id,room_id,tenant_id,status,due_date,issued_at,notes) values('inv-return-'||replace(gen_random_uuid()::text,'-',''),target,c.id,c.room_id,c.tenant_id,'issued',h.actual_return_date,now(),'Final return charges') returning id into invoice; end if;
   perform set_config('zeno.checkout_invoice_mutation',invoice::text,true);
   insert into public.invoice_charges(invoice_id,charge_type,label,source_type,source_id,quantity,unit_price,amount,metadata,sort_order) values(invoice,charge->>'chargeType',charge->>'label',charge->>'sourceType',(charge->>'sourceId')::uuid,(charge->>'quantity')::numeric,(charge->>'unitPrice')::numeric,(charge->>'amount')::numeric,charge->'metadata'||jsonb_build_object('final_bill_id',fb.id,'billing_period_id',target,'contract_id',c.id,'room_id',c.room_id),100);
   update public.invoices set subtotal_amount=subtotal_amount+(charge->>'amount')::numeric,total_amount=total_amount+(charge->>'amount')::numeric,balance_amount=balance_amount+(charge->>'amount')::numeric,status=case when balance_amount+(charge->>'amount')::numeric=0 then 'paid' when paid_amount>0 then 'partial' else 'issued' end,paid_at=case when balance_amount+(charge->>'amount')::numeric=0 then paid_at else null end where id=invoice;
   perform set_config('zeno.checkout_invoice_mutation','',true);
   insert into public.billing_audit_events(billing_period_id,actor_id,action,entity_type,entity_id,after_data) values(target,p_actor_id,'invoice.return_charge.appended','invoice',invoice,charge);
 end loop;
 perform public.contract_checkout_audit(c.id,p_actor_id,'contract.checkout.final_bill_issued',p_operation_id,preview);
 return public.contract_checkout_get(c.id);
end $$;

create or replace function public.contract_checkout_credit(p_contract_id uuid,p_actor_id uuid,p_payment_id uuid,p_amount numeric,p_reason text,p_operation_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.contract_payments%rowtype; source public.contract_checkout_sources%rowtype;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 perform 1 from public.contracts where id=p_contract_id for update;
 select * into source from public.contract_checkout_sources where operation_id=p_operation_id;
 if found then if source.contract_id=p_contract_id and source.payment_id=p_payment_id and source.approved_amount=p_amount and source.reason=btrim(p_reason) and source.approved_by is not distinct from p_actor_id then return public.contract_checkout_get(p_contract_id); end if; raise exception 'CHECKOUT_OPERATION_CONFLICT'; end if;
 if not exists(select 1 from public.contract_checkouts where contract_id=p_contract_id and status='returned' and financial_mode='settlement') then raise exception 'CHECKOUT_PILOT_REQUIRED'; end if;
 if exists(select 1 from public.contract_checkout_statements s join public.contract_checkouts h on h.id=s.checkout_id where h.contract_id=p_contract_id) then raise exception 'CHECKOUT_ALREADY_CONFIRMED'; end if;
 select * into p from public.contract_payments where id=p_payment_id and contract_id=p_contract_id for update;
 if not found or p.payment_type not in ('other','prepaid_rent') or p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or p_amount>p.amount or exists(select 1 from public.contract_checkout_sources where payment_id=p.id) or length(btrim(coalesce(p_reason,'')))=0 then raise exception 'CHECKOUT_CREDIT_INVALID'; end if;
 insert into public.contract_checkout_sources(contract_id,payment_id,source_type,approved_amount,reason,operation_id,approved_by) values(p_contract_id,p.id,'credit',p_amount,btrim(p_reason),p_operation_id,p_actor_id);
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.credit_approved',p_operation_id,jsonb_build_object('paymentId',p.id,'amount',p_amount,'reason',p_reason));
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_charge(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_label text,p_amount numeric,p_note text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; target uuid; replay public.billing_incidental_charges%rowtype; c public.contracts%rowtype;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 select * into c from public.contracts where id=p_contract_id for update;
 select * into h from public.contract_checkouts where contract_id=p_contract_id for update;
 if h.id is null then raise exception 'CHECKOUT_DRAFT_REQUIRED'; end if;
 select * into replay from public.billing_incidental_charges where operation_id=p_operation_id;
 if found then if replay.contract_id=p_contract_id and replay.label=btrim(p_label) and replay.amount=p_amount and replay.note is not distinct from p_note and replay.created_by is not distinct from p_actor_id then return public.contract_checkout_get(p_contract_id); end if; raise exception 'CHECKOUT_OPERATION_CONFLICT'; end if;
 if h.financial_mode='legacy' then raise exception 'CHECKOUT_LEGACY_RETURN'; end if;
 if exists(select 1 from public.contract_checkout_statements where checkout_id=h.id) or exists(select 1 from public.contract_checkout_final_bills where checkout_id=h.id) then raise exception 'CHECKOUT_ALREADY_CONFIRMED'; end if;
 if p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or length(btrim(coalesce(p_label,''))) not between 1 and 200 then raise exception 'CHECKOUT_CHARGE_INVALID'; end if;
 insert into public.billing_periods(building_id,period_year,period_month,opened_by) values(c.building_id,extract(year from h.actual_return_date),extract(month from h.actual_return_date),p_actor_id) on conflict(building_id,period_year,period_month) do nothing;
 select id into target from public.billing_periods where building_id=c.building_id and period_year=extract(year from h.actual_return_date) and period_month=extract(month from h.actual_return_date) for update;
 if exists(select 1 from public.billing_periods where id=target and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 insert into public.billing_incidental_charges(billing_period_id,contract_id,room_id,label,amount,note,operation_id,created_by) values(target,c.id,c.room_id,btrim(p_label),p_amount,p_note,p_operation_id,p_actor_id);
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.charge_added',p_operation_id,jsonb_build_object('label',p_label,'amount',p_amount,'note',p_note));
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_refund(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_amount numeric,p_paid_at date,p_payment_method text,p_note text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.contract_checkouts%rowtype; s public.contract_checkout_statements%rowtype; replay record; source record; remainder numeric; take numeric; due numeric;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 perform 1 from public.contracts where id=p_contract_id for update;
 select * into h from public.contract_checkouts where contract_id=p_contract_id for update;
 select * into s from public.contract_checkout_statements where checkout_id=h.id for update;
 if s.id is null then raise exception 'CHECKOUT_CONFIRM_REQUIRED'; end if;
 select sum(amount) amount,min(statement_id::text) statement_id,min(paid_at) paid_at,min(payment_method) payment_method,min(note) note,min(recorded_by::text) recorded_by into replay from public.contract_checkout_refunds where operation_id=p_operation_id;
 if replay.amount is not null then
 if replay.amount=p_amount and replay.statement_id=s.id::text and replay.paid_at=p_paid_at and replay.payment_method=p_payment_method and replay.note is not distinct from p_note and replay.recorded_by is not distinct from p_actor_id::text then return public.contract_checkout_get(p_contract_id); end if; raise exception 'CHECKOUT_OPERATION_CONFLICT'; end if;
 if h.financial_mode='legacy' then raise exception 'CHECKOUT_LEGACY_RETURN'; end if;
 perform 1 from public.contract_checkout_sources where contract_id=p_contract_id order by id for update;
 select coalesce(sum(public.contract_checkout_source_balance(id)),0) into due from public.contract_checkout_sources where contract_id=p_contract_id;
 if p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or p_amount>due or p_paid_at is null or length(btrim(coalesce(p_payment_method,'')))=0 then raise exception 'CHECKOUT_REFUND_INVALID'; end if;
 if exists(select 1 from public.invoices where contract_id=p_contract_id and status<>'void' and balance_amount>0) then raise exception 'CHECKOUT_OUTSTANDING_DEBT'; end if;
 perform 1 from public.billing_periods where building_id=h.building_id and period_year=extract(year from p_paid_at) and period_month=extract(month from p_paid_at) for update;
 if exists(select 1 from public.billing_periods where building_id=h.building_id and period_year=extract(year from p_paid_at) and period_month=extract(month from p_paid_at) and status='closed') or exists(select 1 from public.operations_report_periods where building_id=h.building_id and period_year=extract(year from p_paid_at) and period_month=extract(month from p_paid_at) and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 remainder:=p_amount;
 for source in select * from public.contract_checkout_sources where contract_id=p_contract_id order by source_type,created_at,id loop
 take:=least(remainder,public.contract_checkout_source_balance(source.id));
 if take>0 then insert into public.contract_checkout_refunds(statement_id,source_id,operation_id,amount,paid_at,payment_method,note,recorded_by) values(s.id,source.id,p_operation_id,take,p_paid_at,p_payment_method,p_note,p_actor_id); remainder:=remainder-take; end if;
 exit when remainder=0;
 end loop;
 if remainder<>0 then raise exception 'CHECKOUT_SOURCE_BALANCE_INVALID'; end if;
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.refund_recorded',p_operation_id,jsonb_build_object('amount',p_amount,'paidAt',p_paid_at,'paymentMethod',p_payment_method,'note',p_note));
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_correct(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_invoice_id uuid,p_amount numeric,p_label text,p_reason text,p_expected_updated_at timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.invoices%rowtype; h public.contract_checkouts%rowtype; s public.contract_checkout_statements%rowtype; replay public.invoice_charges%rowtype; target uuid; source record; item record; available numeric; take numeric;
begin
 if p_operation_id is null then raise exception 'CHECKOUT_OPERATION_REQUIRED'; end if;
 perform 1 from public.contracts where id=p_contract_id for update;
 select * into h from public.contract_checkouts where contract_id=p_contract_id for update;
 select * into s from public.contract_checkout_statements where checkout_id=h.id for update;
 if s.id is null then raise exception 'CHECKOUT_CONFIRM_REQUIRED'; end if;
 select * into replay from public.invoice_charges where metadata->>'checkout_correction_operation_id'=p_operation_id::text;
 if found then
 if replay.invoice_id=p_invoice_id and replay.amount=p_amount and replay.label=btrim(p_label) and replay.metadata->>'reason'=btrim(p_reason) and replay.metadata->>'actor_id' is not distinct from p_actor_id::text and replay.metadata->>'statement_id'=s.id::text then return public.contract_checkout_get(p_contract_id); end if;
 raise exception 'CHECKOUT_OPERATION_CONFLICT'; end if;
 if h.financial_mode='legacy' then raise exception 'CHECKOUT_LEGACY_RETURN'; end if;
 perform 1 from public.contract_checkout_sources where contract_id=p_contract_id order by id for update;
 perform 1 from public.billing_periods p where exists(select 1 from public.invoices q where q.contract_id=p_contract_id and q.billing_period_id=p.id) order by id for update;
 perform 1 from public.invoices where contract_id=p_contract_id order by id for update;
 select billing_period_id into target from public.invoices where id=p_invoice_id and contract_id=p_contract_id;
 if target is null then raise exception 'CHECKOUT_INVOICE_NOT_FOUND'; end if;
 perform 1 from public.billing_periods where id=target for update;
 if exists(select 1 from public.billing_periods where id=target and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 select * into i from public.invoices where id=p_invoice_id for update;
 if i.status='void' then raise exception 'CHECKOUT_INVOICE_NOT_FOUND'; end if;
 if i.updated_at is distinct from p_expected_updated_at then raise exception 'CHECKOUT_VERSION_CONFLICT'; end if;
 if p_amount is null or p_amount=0 or p_amount<>trunc(p_amount) or length(btrim(coalesce(p_label,''))) not between 1 and 200 or length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'CHECKOUT_CORRECTION_INVALID'; end if;
 if i.total_amount+p_amount<i.paid_amount or i.subtotal_amount+p_amount<0 then raise exception 'CHECKOUT_CORRECTION_REQUIRES_RECONCILIATION'; end if;
 perform set_config('zeno.checkout_invoice_mutation',i.id::text,true);
 insert into public.invoice_charges(invoice_id,charge_type,label,source_type,source_id,quantity,unit_price,amount,metadata,sort_order) values(i.id,'adjustment',btrim(p_label),'contract_checkout_correction',s.id,1,p_amount,p_amount,jsonb_build_object('statement_id',s.id,'checkout_correction_operation_id',p_operation_id,'reason',btrim(p_reason),'actor_id',p_actor_id),200);
 update public.invoices set subtotal_amount=subtotal_amount+p_amount,total_amount=total_amount+p_amount,balance_amount=balance_amount+p_amount,status=case when balance_amount+p_amount=0 then 'paid' when paid_amount>0 then 'partial' else 'issued' end,paid_at=case when balance_amount+p_amount=0 then now() else null end where id=i.id;
 perform set_config('zeno.checkout_invoice_mutation','',true);
 -- Apply still-held X then D, preserving the original receipt and statement.
 for source in select * from public.contract_checkout_sources where contract_id=p_contract_id order by case source_type when 'credit' then 0 else 1 end,created_at,id loop
 available:=public.contract_checkout_source_balance(source.id);
 for item in select q.* from public.invoices q where contract_id=p_contract_id and status<>'void' and balance_amount>0 order by due_date nulls last,created_at,id loop
 exit when available<=0;
 if exists(select 1 from public.billing_periods where id=item.billing_period_id and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 take:=least(available,item.balance_amount);
 insert into public.invoice_payments(invoice_id,amount,paid_at,payment_method,note,recorded_by,funding_source,checkout_source_id,checkout_statement_id) values(item.id,take,current_date,'checkout_allocation','Additional held receipt allocation after correction',p_actor_id,source.source_type,source.id,s.id);
 update public.invoices set paid_amount=paid_amount+take,balance_amount=balance_amount-take,status=case when balance_amount-take=0 then 'paid' else 'partial' end,paid_at=case when balance_amount-take=0 then now() else paid_at end where id=item.id;
 available:=available-take;
 end loop;
 end loop;
 insert into public.billing_audit_events(billing_period_id,actor_id,action,entity_type,entity_id,after_data,metadata) values(target,p_actor_id,'invoice.checkout.corrected','invoice',i.id,jsonb_build_object('amount',p_amount,'reason',btrim(p_reason),'label',btrim(p_label)),jsonb_build_object('statement_id',s.id,'operation_id',p_operation_id));
 perform public.contract_checkout_audit(p_contract_id,p_actor_id,'contract.checkout.corrected',p_operation_id,jsonb_build_object('invoiceId',i.id,'amount',p_amount,'reason',btrim(p_reason),'label',btrim(p_label)));
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_undo_cash(p_contract_id uuid,p_actor_id uuid,p_invoice_id uuid,p_payment_id uuid,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.invoices%rowtype; p public.invoice_payments%rowtype; target uuid; paid numeric;
begin
 perform 1 from public.contracts where id=p_contract_id for update;
 if not exists(select 1 from public.contract_checkouts where contract_id=p_contract_id) then raise exception 'CHECKOUT_DRAFT_REQUIRED'; end if;
 select billing_period_id into target from public.invoices where id=p_invoice_id and contract_id=p_contract_id;
 if target is null then raise exception 'CHECKOUT_INVOICE_NOT_FOUND'; end if;
 perform 1 from public.billing_periods where id=target for update;
 if exists(select 1 from public.billing_periods where id=target and status='closed') then raise exception 'CHECKOUT_PERIOD_CLOSED'; end if;
 select * into i from public.invoices where id=p_invoice_id for update;
 if i.status='void' then raise exception 'CHECKOUT_INVOICE_NOT_FOUND'; end if;
 select * into p from public.invoice_payments where id=p_payment_id and invoice_id=i.id for update;
 if not found then raise exception 'CHECKOUT_PAYMENT_NOT_FOUND'; end if;
 if p.funding_source<>'cash' then raise exception 'CHECKOUT_ALLOCATION_PROTECTED'; end if;
 if p.deleted_at is not null then return public.contract_checkout_get(p_contract_id); end if;
 if exists(select 1 from public.contract_checkouts where contract_id=p_contract_id and financial_mode='legacy') then raise exception 'CHECKOUT_LEGACY_RETURN'; end if;
 update public.invoice_payments set deleted_at=clock_timestamp(),deleted_by=p_actor_id,delete_reason=p_reason where id=p.id;
 select coalesce(sum(amount),0) into paid from public.invoice_payments where invoice_id=i.id and deleted_at is null;
 update public.invoices set paid_amount=paid,balance_amount=total_amount-paid,status=case when paid<=0 then 'issued' when total_amount-paid<=0 then 'paid' else 'partial' end,paid_at=case when total_amount-paid<=0 then paid_at else null end where id=i.id;
 insert into public.billing_audit_events(billing_period_id,actor_id,action,entity_type,entity_id,before_data,after_data,metadata) values(target,p_actor_id,'payment.undone','invoice',i.id,to_jsonb(i),jsonb_build_object('paid_amount',paid,'balance_amount',i.total_amount-paid),jsonb_build_object('payment_id',p.id,'amount',p.amount,'reason',p_reason,'checkout_contract_id',p_contract_id));
 return public.contract_checkout_get(p_contract_id);
end $$;

create or replace function public.contract_checkout_lifecycle_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.status='active' and new.status in ('terminated','expired') and current_setting('zeno.checkout_return_contract',true) is distinct from old.id::text then raise exception 'CHECKOUT_LIFECYCLE_REQUIRED'; end if;
 end if;
 if exists(select 1 from public.contract_checkouts where contract_id=old.id) then
 if tg_op='DELETE' then raise exception 'CHECKOUT_HISTORY_PROTECTED'; end if;
 if new.end_date is distinct from old.end_date or new.start_date is distinct from old.start_date or new.room_id is distinct from old.room_id or new.tenant_id is distinct from old.tenant_id or new.building_id is distinct from old.building_id or new.original_end_date is distinct from old.original_end_date then raise exception 'CHECKOUT_HISTORY_PROTECTED'; end if;
 if new.status is distinct from old.status and not (new.status='terminated' and old.status<>'terminated' and current_setting('zeno.checkout_return_contract',true)=old.id::text) then raise exception 'CHECKOUT_LIFECYCLE_REQUIRED'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.contract_checkout_meter_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare row_data jsonb; cid uuid; room uuid; year integer; month integer;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 cid:=(row_data->>'contract_id')::uuid; room:=(row_data->>'room_id')::uuid;
 if tg_table_name='meter_readings' then
 if row_data->>'reading_type'<>'monthly' and cid is null and tg_op='INSERT' then raise exception 'CHECKOUT_HANDOVER_CONTRACT_REQUIRED'; end if;
 if cid is not null and not exists(select 1 from public.contracts where id=cid and room_id=room and building_id=(row_data->>'building_id')::uuid) then raise exception 'CHECKOUT_METER_SCOPE_INVALID'; end if;
 year:=(row_data->>'period_year')::integer; month:=(row_data->>'period_month')::integer;
 else
 select period_year,period_month into year,month from public.billing_periods where id=(row_data->>'billing_period_id')::uuid;
 end if;
 if exists(select 1 from public.contract_checkouts h join public.contracts c on c.id=h.contract_id where c.room_id=room and h.status='returned' and ((cid=h.contract_id) or (cid is null and extract(year from h.actual_return_date)=year and extract(month from h.actual_return_date)=month and not exists(select 1 from public.contracts successor where successor.room_id=room and successor.id<>h.contract_id and successor.status='active' and successor.start_date>h.actual_return_date and extract(year from successor.start_date)=year and extract(month from successor.start_date)=month)))) then raise exception 'CHECKOUT_METER_HISTORY_PROTECTED'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.contract_checkout_invoice_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' or (tg_op='UPDATE' and new.status='void') then
 if exists(select 1 from public.invoice_payments where invoice_id=old.id and funding_source<>'cash') or exists(select 1 from public.invoice_charges where invoice_id=old.id and (metadata ? 'statement_id' or metadata ? 'final_bill_id')) then raise exception 'CHECKOUT_INVOICE_HISTORY_PROTECTED'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.contract_checkout_final_charge_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.metadata ? 'statement_id' or old.metadata ? 'final_bill_id' then raise exception 'CHECKOUT_INVOICE_HISTORY_PROTECTED'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.contract_checkout_record_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'CHECKOUT_HISTORY_PROTECTED'; end if;
 if old.status='returned' and not (current_setting('zeno.checkout_charge_modes',true)=old.id::text and to_jsonb(new)-'charge_modes'-'updated_at'=to_jsonb(old)-'charge_modes'-'updated_at') then raise exception 'CHECKOUT_HISTORY_PROTECTED'; end if;
 if new.contract_id<>old.contract_id or new.building_id<>old.building_id then raise exception 'CHECKOUT_HISTORY_PROTECTED'; end if;
 if new.status<>old.status and current_setting('zeno.checkout_return_contract',true) is distinct from old.contract_id::text then raise exception 'CHECKOUT_LIFECYCLE_REQUIRED'; end if;
 return new;
end $$;

create or replace function public.contract_checkout_charge_insert_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.metadata ? 'statement_id' or new.metadata ? 'final_bill_id') and current_setting('zeno.checkout_invoice_mutation',true) is distinct from new.invoice_id::text then raise exception 'CHECKOUT_INVOICE_HISTORY_PROTECTED'; end if;
 return new;
end $$;

create trigger checkout_final_bill_immutable before update or delete on public.contract_checkout_final_bills for each row execute function public.contract_checkout_history_guard();
create unique index checkout_final_charge_identity on public.invoice_charges((metadata->>'checkout_id'),(metadata->>'checkout_charge_key')) where metadata ? 'checkout_charge_key';

-- Keep the same server-only grants as the fresh checkout migration.
do $$ declare table_name text; function_name regprocedure; begin
 foreach table_name in array array['contract_checkouts','contract_checkout_sources','contract_checkout_statements','contract_checkout_final_bills','contract_checkout_refunds'] loop
 execute format('alter table public.%I enable row level security',table_name);
 execute format('revoke all on public.%I from public,anon,authenticated',table_name);
 execute format('grant select,insert,update,delete on public.%I to service_role',table_name);
 end loop;
 for function_name in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'contract_checkout_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',function_name);
 execute format('grant execute on function %s to service_role',function_name);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
