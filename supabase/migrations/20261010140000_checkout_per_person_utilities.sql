-- Checkout settlement: cover per-person/fixed utility pricing.
-- 1. contract_checkout_get exposes live building pricing types (usable before a draft exists).
-- 2. contract_checkout_return freezes an occupant count consistent with monthly billing and
--    stops persisting handover_out readings for buildings that are not metered.
-- 3. contract_checkout_preview labels per-person utility charges like monthly billing does.

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
     union all select 'electricity_fixed','electricity',case when h.pricing_snapshot->'building'->>'electricityPricingType'='per_person' then 'Tiền điện (theo người)' else 'Tiền điện (cố định)' end,(h.pricing_snapshot->'building'->>'electricityRate')::numeric,case when h.pricing_snapshot->'building'->>'electricityPricingType'='per_person' then (h.pricing_snapshot->>'occupantCount')::numeric else 1::numeric end,'building',c.building_id where h.pricing_snapshot->'building'->>'electricityPricingType' in ('fixed','per_person')
     union all select 'water_fixed','water',case when h.pricing_snapshot->'building'->>'waterPricingType'='per_person' then 'Tiền nước (theo người)' else 'Tiền nước (cố định)' end,(h.pricing_snapshot->'building'->>'waterRate')::numeric,case when h.pricing_snapshot->'building'->>'waterPricingType'='per_person' then (h.pricing_snapshot->>'occupantCount')::numeric else 1::numeric end,'building',c.building_id where h.pricing_snapshot->'building'->>'waterPricingType' in ('fixed_per_room','per_person')
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
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',coalesce(cs.approved_amount,0)) order by p.id),'[]') from public.contract_payments p left join public.contract_checkout_sources cs on p.id=cs.payment_id where p.contract_id=p_contract_id),
 'buildingPricing',case when b.id is null then null else jsonb_build_object('electricityPricingType',b.electricity_pricing_type,'waterPricingType',b.water_pricing_type,'electricityRate',b.default_electricity_rate,'waterRate',b.default_water_rate) end);
end $$;

create or replace function public.contract_checkout_return(p_contract_id uuid,p_actor_id uuid,p_operation_id uuid,p_expected_updated_at timestamptz,p_financial_mode text default 'standard') returns jsonb language plpgsql security invoker set search_path='' as $$
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
 -- Only metered pricing bills from readings; storing one for per-person/fixed buildings is noise.
 if pricing in ('per_kwh','per_m3','tiered') and input is not null and input<>'null'::jsonb then
   if exists(select 1 from public.meter_readings m where m.contract_id=c.id and m.meter_type=meter and m.reading_type='handover_out') then
     if not exists(select 1 from public.meter_readings m where m.contract_id=c.id and m.meter_type=meter and m.reading_type='handover_out' and m.reading_date=h.actual_return_date and m.reading_value=(input->>'reading')::numeric) then raise exception 'CHECKOUT_READING_CONFLICT'; end if;
   else
     insert into public.meter_readings(room_id,building_id,contract_id,meter_type,reading_type,period_year,period_month,reading_date,reading_value,recorded_by) values(c.room_id,c.building_id,c.id,meter,'handover_out',extract(year from h.actual_return_date),extract(month from h.actual_return_date),h.actual_return_date,(input->>'reading')::numeric,p_actor_id);
   end if;
 end if;
 end loop;
 -- greatest(active occupants, declared count) mirrors the monthly per-person billing rule.
 update public.contract_checkouts set pricing_snapshot=jsonb_build_object('monthlyRent',c.monthly_rent,'discountAmount',c.discount_amount,'surchargeAmount',c.surcharge_amount,'occupantCount',greatest((select count(*) from public.contract_occupants o where o.contract_id=c.id and o.billing_counted and o.move_in_date<=(date_trunc('month',h.actual_return_date)+interval '1 month - 1 day')::date and (o.move_out_date is null or o.move_out_date>=date_trunc('month',h.actual_return_date)::date)),c.occupant_count),'startDate',c.start_date,'building',jsonb_build_object('electricityPricingType',b.electricity_pricing_type,'waterPricingType',b.water_pricing_type,'electricityRate',b.default_electricity_rate,'waterRate',b.default_water_rate),'services',(select coalesce(jsonb_agg(jsonb_build_object('id',cs.id,'catalogId',cs.catalog_id,'label',sc.name,'pricingType',sc.pricing_type,'amount',cs.amount,'quantity',cs.quantity) order by cs.id),'[]'::jsonb) from public.contract_services cs join public.service_catalog sc on sc.id=cs.catalog_id where cs.contract_id=c.id and cs.is_enabled)),financial_mode=p_financial_mode,updated_at=clock_timestamp() where id=h.id;
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

