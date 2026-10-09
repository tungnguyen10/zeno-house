-- Run on the positively identified staging project after the checkout migration.
-- All fixture changes are rolled back. Do not run alongside other operators.
begin;
do $$
declare building_id uuid; fixture_room_id uuid:=gen_random_uuid(); tenant_one uuid:=gen_random_uuid(); tenant_two uuid:=gen_random_uuid(); tenant_next uuid:=gen_random_uuid(); contract_one uuid:=gen_random_uuid(); contract_next uuid:=gen_random_uuid(); actor uuid; bundle jsonb; original_end date:=date '2026-12-31'; failed boolean:=false;
begin
 select id into building_id from public.buildings order by id limit 1;
 select id into actor from auth.users order by id limit 1;
 if building_id is null or actor is null then raise exception 'Staging needs a building and test actor'; end if;
 update public.buildings set electricity_pricing_type='per_kwh',water_pricing_type='per_m3',default_electricity_rate=3000,default_water_rate=3000 where id=building_id;
 insert into public.rooms(id,building_id,room_number,code,slug,status,monthly_rent) values(fixture_room_id,building_id,'return-'||substr(fixture_room_id::text,1,8),'return-'||fixture_room_id,'return-'||fixture_room_id,'occupied',1000000);
 insert into public.tenants(id,code,full_name,phone) values
   (tenant_one,'return-'||tenant_one,'Primary return fixture','09'||lpad((floor(random()*100000000))::text,8,'0')),
   (tenant_two,'return-'||tenant_two,'Roommate return fixture','09'||lpad((floor(random()*100000000))::text,8,'0')),
   (tenant_next,'return-'||tenant_next,'Successor return fixture','09'||lpad((floor(random()*100000000))::text,8,'0'));
 insert into public.contracts(id,contract_code,room_id,building_id,tenant_id,start_date,end_date,monthly_rent,status) values(contract_one,'return-'||contract_one,fixture_room_id,building_id,tenant_one,'2026-10-01',original_end,1000000,'active');
 insert into public.contract_occupants(contract_id,tenant_id,move_in_date,role) values(contract_one,tenant_one,'2026-10-01','primary'),(contract_one,tenant_two,'2026-10-01','roommate');
 insert into public.meter_readings(contract_id,room_id,building_id,meter_type,reading_type,period_year,period_month,reading_date,reading_value) values(contract_one,fixture_room_id,building_id,'electricity','handover_in',2026,10,'2026-10-01',100),(contract_one,fixture_room_id,building_id,'water','handover_in',2026,10,'2026-10-01',20);
 bundle:=public.contract_checkout_save(contract_one,actor,jsonb_build_object('actual_return_date','2026-10-05','reason','Return regression','electricity',jsonb_build_object('reading',95),'water',jsonb_build_object('reading',21)));
 begin
   perform public.contract_checkout_return(contract_one,actor,gen_random_uuid(),(bundle->'checkout'->>'updatedAt')::timestamptz,'standard');
 exception when others then
   if sqlerrm<>'CHECKOUT_READING_BELOW_BASELINE' then raise; end if;
   failed:=true;
 end;
 if not failed or (select status from public.contracts where id=contract_one)<>'active' then raise exception 'Invalid reading did not block return'; end if;
 bundle:=public.contract_checkout_save(contract_one,actor,jsonb_build_object('actual_return_date','2026-10-05','reason','Return regression','electricity',jsonb_build_object('reading',105),'water',jsonb_build_object('reading',21),'expected_updated_at',bundle->'checkout'->>'updatedAt'));
 failed:=false;
 -- A failure after contract/occupant mutation must roll the whole return back.
 create or replace function pg_temp.fail_room_release() returns trigger language plpgsql as $fn$ begin raise exception 'INJECTED_RETURN_FAILURE'; end $fn$;
 execute format('create trigger return_failure before update on public.rooms for each row when (new.id=%L::uuid) execute function pg_temp.fail_room_release()',fixture_room_id);
 begin
   perform public.contract_checkout_return(contract_one,actor,gen_random_uuid(),(bundle->'checkout'->>'updatedAt')::timestamptz,'standard');
 exception when others then
   if sqlerrm<>'INJECTED_RETURN_FAILURE' then raise; end if;
   failed:=true;
 end;
 drop trigger return_failure on public.rooms;
 if not failed or (select status from public.contracts where id=contract_one)<>'active' or exists(select 1 from public.meter_readings where contract_id=contract_one and reading_type='handover_out') or exists(select 1 from public.contract_occupants where contract_id=contract_one and move_out_date is not null) then raise exception 'Failed return left partial state'; end if;
 bundle:=public.contract_checkout_return(contract_one,actor,gen_random_uuid(),(bundle->'checkout'->>'updatedAt')::timestamptz,'standard');
 if (select status from public.contracts where id=contract_one)<>'terminated' or (select end_date from public.contracts where id=contract_one)<>original_end or (select status from public.rooms where id=fixture_room_id)<>'available' or (select count(*) from public.contract_occupants where contract_id=contract_one and move_out_date='2026-10-05')<>2 then raise exception 'Return did not release occupancy atomically'; end if;
 insert into public.contracts(id,contract_code,room_id,building_id,tenant_id,start_date,end_date,monthly_rent,status) values(contract_next,'return-'||contract_next,fixture_room_id,building_id,tenant_next,'2026-10-06','2027-10-05',1000000,'active');
 insert into public.meter_readings(contract_id,room_id,building_id,meter_type,reading_type,period_year,period_month,reading_date,reading_value) values(contract_next,fixture_room_id,building_id,'electricity','handover_in',2026,10,'2026-10-06',105),(contract_next,fixture_room_id,building_id,'water','handover_in',2026,10,'2026-10-06',21);
 if (select count(*) from public.contracts c where c.room_id=fixture_room_id and c.status='active')<>1 then raise exception 'Same-month successor unavailable'; end if;
 raise notice 'Physical return and successor assertions passed (fixtures rolled back)';
end $$;
rollback;
