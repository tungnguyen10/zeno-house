-- Run after 20261110000326_restrict_tenant_portal_profile.sql, as postgres.
-- Uses two existing unlinked Auth users only for transaction-local JWT/link fixtures.
-- No Auth account metadata or existing business row is changed. Every fixture rolls back.
begin;
set local lock_timeout = '5s';

create temporary table portal_restriction_fixture on commit drop as
select gen_random_uuid() as building_id, gen_random_uuid() as room_id,
  gen_random_uuid() as tenant_a, gen_random_uuid() as tenant_b, gen_random_uuid() as tenant_c,
  gen_random_uuid() as contract_id, gen_random_uuid() as request_a, gen_random_uuid() as request_b,
  (select id from auth.users order by created_at, id limit 1) as actor_id,
  users.ids[1] as auth_a, users.ids[2] as auth_b
from (select array_agg(id order by created_at,id) as ids from auth.users u
  where not exists(select 1 from public.tenant_user_links l where l.auth_user_id=u.id)) users;
grant select on portal_restriction_fixture to authenticated, anon, service_role;

do $$
begin
  if exists(select 1 from portal_restriction_fixture where actor_id is null or auth_a is null or auth_b is null) then
    raise exception 'QA_REQUIRES_TWO_UNLINKED_AUTH_USERS';
  end if;
  if pg_catalog.has_any_column_privilege('authenticated','public.tenants','SELECT')
     or pg_catalog.has_any_column_privilege('anon','public.tenants','SELECT')
     or pg_catalog.has_any_column_privilege('authenticated','public.support_requests','SELECT')
     or pg_catalog.has_any_column_privilege('anon','public.support_requests','SELECT') then
    raise exception 'QA_RAW_SELECT_NOT_REVOKED';
  end if;
  if not pg_catalog.has_table_privilege('service_role','public.tenants','SELECT')
     or not pg_catalog.has_table_privilege('service_role','public.support_requests','SELECT') then
    raise exception 'QA_SERVICE_READ_MISSING';
  end if;
  if pg_catalog.has_function_privilege('anon','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE') then
    raise exception 'QA_RPC_ACL_INVALID';
  end if;
end;
$$;

insert into public.buildings(id,code,slug,name,address)
select building_id,'restrict-'||building_id,'restrict-'||building_id,'Restriction fixture','Verification only' from portal_restriction_fixture;
insert into public.rooms(id,building_id,room_number,code,slug)
select room_id,building_id,'QA','restrict-'||room_id,'restrict-'||room_id from portal_restriction_fixture;
insert into public.tenants(id,code,full_name,phone,notes,id_card_front_path)
select person.id,'restrict-'||person.id,'Fictional restriction tenant',
  '+999'||lpad((floor(random()*100000000000))::bigint::text,11,'0'),
  'PRIVATE_STAFF_FIXTURE',person.id||'/front/original.jpg'
from portal_restriction_fixture f cross join lateral (values(f.tenant_a),(f.tenant_b),(f.tenant_c)) person(id);
insert into public.tenant_user_links(auth_user_id,tenant_id,status)
select auth_a,tenant_a,'active' from portal_restriction_fixture
union all select auth_b,tenant_b,'active' from portal_restriction_fixture;
insert into public.contracts(id,contract_code,building_id,room_id,tenant_id,start_date,end_date,monthly_rent,status)
select contract_id,'restrict-'||contract_id,building_id,room_id,tenant_a,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date-30,(now() at time zone 'Asia/Ho_Chi_Minh')::date+30,1000,'active'
from portal_restriction_fixture;
insert into public.contract_occupants(contract_id,tenant_id,role,move_in_date)
select contract_id,tenant_b,'roommate',(now() at time zone 'Asia/Ho_Chi_Minh')::date-1 from portal_restriction_fixture;
-- Metadata rows only; no real Storage bytes are uploaded, replaced or deleted.
insert into storage.objects(bucket_id,name)
select 'tenant-id-images',tenant_a||'/front/original.jpg' from portal_restriction_fixture
union all select 'tenant-id-images',tenant_c||'/front/original.jpg' from portal_restriction_fixture;

select set_config('request.jwt.claims',jsonb_build_object('sub',auth_a,'role','authenticated','app_metadata',jsonb_build_object('role','tenant'))::text,true)
from portal_restriction_fixture;
set local role authenticated;
-- Bypass the generic Storage SQL-delete safety trigger only within this rolled-back
-- fixture so the following DELETE check actually exercises RLS, not that trigger.
set local storage.allow_delete_query = 'true';
do $$
declare n integer;
begin
  begin perform 1 from public.tenants limit 1; raise exception 'QA_TENANT_RAW_READ_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.support_requests limit 1; raise exception 'QA_REQUEST_RAW_READ_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin perform public.update_tenant_support_request_status_with_audit((select request_a from portal_restriction_fixture),'new','in_progress',(select actor_id from portal_restriction_fixture));
    raise exception 'QA_TENANT_RPC_ALLOWED'; exception when insufficient_privilege then null; end;
  if (select count(*) from storage.objects where bucket_id='tenant-id-images' and name=(select tenant_a||'/front/original.jpg' from portal_restriction_fixture)) <> 1 then
    raise exception 'QA_OWN_CANONICAL_READ_DENIED'; end if;
  if exists(select 1 from storage.objects where bucket_id='tenant-id-images' and name=(select tenant_c||'/front/original.jpg' from portal_restriction_fixture)) then
    raise exception 'QA_FOREIGN_CANONICAL_READ_ALLOWED'; end if;
  begin
    insert into storage.objects(bucket_id,name) select 'tenant-id-images',tenant_a||'/back/new.jpg' from portal_restriction_fixture;
    raise exception 'QA_CANONICAL_INSERT_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(id,bucket_id,name)
    select object.id,object.bucket_id,object.name from storage.objects object
    where object.bucket_id='tenant-id-images' and object.name=(select tenant_a||'/front/original.jpg' from portal_restriction_fixture)
    on conflict(id) do update set metadata='{"qa":true}'::jsonb;
    raise exception 'QA_CANONICAL_UPSERT_ALLOWED';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata='{"qa":true}'::jsonb where bucket_id='tenant-id-images' and name=(select tenant_a||'/front/original.jpg' from portal_restriction_fixture);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'QA_CANONICAL_UPDATE_ALLOWED'; end if;
  delete from storage.objects where bucket_id='tenant-id-images' and name=(select tenant_a||'/front/original.jpg' from portal_restriction_fixture);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'QA_CANONICAL_DELETE_ALLOWED'; end if;
  insert into storage.objects(bucket_id,name) select 'tenant-documents',tenant_a||'/requests/evidence.pdf' from portal_restriction_fixture;
  if not exists(select 1 from storage.objects where bucket_id='tenant-documents' and name=(select tenant_a||'/requests/evidence.pdf' from portal_restriction_fixture)) then
    raise exception 'QA_REQUEST_EVIDENCE_READ_DENIED'; end if;
end;
$$;
insert into public.support_requests(id,tenant_id,building_id,contract_id,title,description,attachment_path)
select request_a,tenant_a,building_id,contract_id,'Private correction fixture','PRIVATE_CORRECTION_FIXTURE',tenant_a||'/requests/evidence.pdf'
from portal_restriction_fixture;
do $$
begin
  begin
    insert into public.support_requests(tenant_id,building_id,contract_id,title,description,status)
    select tenant_a,building_id,contract_id,'Fixture','Fixture','resolved' from portal_restriction_fixture;
    raise exception 'QA_TENANT_RESOLVED_INSERT_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.support_requests(tenant_id,building_id,contract_id,title,description,attachment_path)
    select tenant_a,building_id,contract_id,'Fixture','Fixture',tenant_c||'/requests/foreign.pdf' from portal_restriction_fixture;
    raise exception 'QA_FOREIGN_EVIDENCE_REFERENCE_ALLOWED';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Current roommate request creation must still work.
select set_config('request.jwt.claims',jsonb_build_object('sub',auth_b,'role','authenticated','app_metadata',jsonb_build_object('role','tenant'))::text,true)
from portal_restriction_fixture;
set local role authenticated;
insert into public.support_requests(id,tenant_id,building_id,contract_id,title,description)
select request_b,tenant_b,building_id,contract_id,'Roommate correction fixture','PRIVATE_ROOMMATE_FIXTURE' from portal_restriction_fixture;
reset role;
set local role anon;
do $$
begin
  begin perform 1 from public.tenants limit 1; raise exception 'QA_ANON_RAW_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform public.update_tenant_support_request_status_with_audit((select request_a from portal_restriction_fixture),'new','in_progress',(select actor_id from portal_restriction_fixture));
    raise exception 'QA_ANON_RPC_ALLOWED'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role service_role;
do $$
declare f record; result jsonb; n integer;
begin
  select * into f from portal_restriction_fixture;
  result:=public.update_tenant_support_request_status_with_audit(f.request_a,'new','in_progress',f.actor_id);
  if result->>'status' <> 'in_progress' then raise exception 'QA_START_FAILED'; end if;
  perform public.update_tenant_support_request_status_with_audit(f.request_a,'new','in_progress',f.actor_id);
  select count(*) into n from public.audit_events where entity_id=f.request_a and action='support_request.status_updated';
  if n <> 1 then raise exception 'QA_RETRY_DUPLICATED_AUDIT'; end if;
  begin
    perform public.update_tenant_support_request_status_with_audit(f.request_a,'new','resolved',f.actor_id);
    raise exception 'QA_STALE_OVERWRITE_ALLOWED';
  exception when raise_exception then if sqlerrm <> 'SUPPORT_REQUEST_STATUS_STALE' then raise; end if; end;
  begin
    perform public.update_tenant_support_request_status_with_audit(f.request_b,'new','resolved',f.actor_id);
    raise exception 'QA_INVALID_TRANSITION_ALLOWED';
  exception when invalid_parameter_value then if sqlerrm <> 'SUPPORT_REQUEST_STATUS_TRANSITION_INVALID' then raise; end if; end;
  perform public.update_tenant_support_request_status_with_audit(f.request_a,'in_progress','resolved',f.actor_id);
  perform public.update_tenant_support_request_status_with_audit(f.request_a,'resolved','in_progress',f.actor_id);
  if (select count(*) from public.audit_events where entity_id=f.request_a and action='support_request.status_updated') <> 3 then
    raise exception 'QA_TRANSITION_AUDIT_COUNT_INVALID'; end if;
  if exists(select 1 from public.audit_events where entity_id=f.request_a and action='support_request.status_updated'
      and (before_data ? 'description' or after_data ? 'description' or before_data ? 'title' or after_data ? 'title'
        or metadata::text like '%PRIVATE_%' or after_data::text like '%PRIVATE_%')) then
    raise exception 'QA_PRIVATE_TEXT_IN_AUDIT'; end if;
  if exists(select 1 from public.tenants where id in(f.tenant_a,f.tenant_b,f.tenant_c)
      and (notes is distinct from 'PRIVATE_STAFF_FIXTURE' or id_card_front_path is distinct from (id||'/front/original.jpg'))) then
    raise exception 'QA_CANONICAL_PROFILE_MUTATED'; end if;
  -- Service-owned canonical metadata write remains possible for staff APIs.
  update storage.objects set metadata='{"qa_service":true}'::jsonb where bucket_id='tenant-id-images' and name=f.tenant_a||'/front/original.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'QA_SERVICE_CANONICAL_ACCESS_DENIED'; end if;
end;
$$;
reset role;

create function pg_temp.reject_restriction_audit() returns trigger language plpgsql as $$
begin raise exception 'QA_AUDIT_FAILURE'; end;
$$;
create trigger qa_restriction_audit_failure before insert on public.audit_events
for each row when (new.action='support_request.status_updated') execute function pg_temp.reject_restriction_audit();
set local role service_role;
do $$
declare f record;
begin
  select * into f from portal_restriction_fixture;
  begin
    perform public.update_tenant_support_request_status_with_audit(f.request_a,'in_progress','resolved',f.actor_id);
    raise exception 'QA_AUDIT_FAILURE_WAS_IGNORED';
  exception when raise_exception then if sqlerrm <> 'QA_AUDIT_FAILURE' then raise; end if; end;
  if (select status from public.support_requests where id=f.request_a) <> 'in_progress'
     or (select count(*) from public.audit_events where entity_id=f.request_a and action='support_request.status_updated') <> 3 then
    raise exception 'QA_AUDIT_FAILURE_NOT_ATOMIC'; end if;
end;
$$;
reset role;
set constraints all immediate;
rollback;
select true as restricted_portal_profile_verified;
