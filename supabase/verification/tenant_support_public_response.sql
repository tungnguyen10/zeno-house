-- Run as postgres after 20261127090000 and 20261127091000. Creates fictional
-- business rows in a rolled-back transaction; requires one existing Auth actor.
-- This file is a deployment gate, not evidence that cloud checks have run.
begin;
set local lock_timeout = '5s';

create temporary table support_reply_fixture on commit drop as
select gen_random_uuid() as building_id, gen_random_uuid() as room_id,
  gen_random_uuid() as tenant_id, gen_random_uuid() as contract_id,
  gen_random_uuid() as request_id,
  (select id from auth.users order by created_at, id limit 1) as actor_id;
grant select on support_reply_fixture to service_role;

do $$
begin
  if (select actor_id from support_reply_fixture) is null then raise exception 'VERIFY_ACTOR_REQUIRED'; end if;
  if pg_catalog.has_any_column_privilege('authenticated','public.support_requests','INSERT')
    or pg_catalog.has_any_column_privilege('authenticated','public.support_requests','UPDATE')
    or pg_catalog.has_table_privilege('authenticated','public.support_requests','DELETE') then
    raise exception 'VERIFY_BROWSER_REQUEST_WRITES_NOT_REVOKED';
  end if;
  if pg_catalog.has_function_privilege('authenticated','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid,timestamptz,text)','EXECUTE')
    or pg_catalog.has_function_privilege('anon','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid,timestamptz,text)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid,timestamptz,text)','EXECUTE') then
    raise exception 'VERIFY_REPLY_RPC_ACL_INVALID';
  end if;
  if to_regprocedure('public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)') is null then
    raise exception 'VERIFY_ROLLOUT_STATUS_RPC_MISSING';
  end if;
  if pg_catalog.has_function_privilege('authenticated','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('anon','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role','public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)','EXECUTE') then
    raise exception 'VERIFY_ROLLOUT_STATUS_RPC_ACL_INVALID';
  end if;
end;
$$;

insert into public.buildings(id,code,slug,name,address)
select building_id,'reply-'||building_id,'reply-'||building_id,'Support reply fixture','Verification only' from support_reply_fixture;
insert into public.rooms(id,building_id,room_number,code,slug)
select room_id,building_id,'QA','reply-'||room_id,'reply-'||room_id from support_reply_fixture;
insert into public.tenants(id,code,full_name,phone,notes)
select tenant_id,'reply-'||tenant_id,'Fictional support tenant','+999'||lpad((floor(random()*100000000000))::bigint::text,11,'0'),'UNCHANGED_PROFILE_FIXTURE' from support_reply_fixture;
insert into public.contracts(id,contract_code,building_id,room_id,tenant_id,start_date,end_date,monthly_rent,status)
select contract_id,'reply-'||contract_id,building_id,room_id,tenant_id,current_date-1,current_date+30,1000,'active' from support_reply_fixture;
insert into public.support_requests(id,tenant_id,building_id,contract_id,title,description)
select request_id,tenant_id,building_id,contract_id,'Fictional support request','PRIVATE_REQUEST_FIXTURE' from support_reply_fixture;

set local role service_role;
do $$
declare f record; old_version timestamptz; changed jsonb; reply_version timestamptz; before_count integer;
begin
  select * into f from support_reply_fixture;
  select updated_at into old_version from public.support_requests where id=f.request_id;
  changed := public.update_tenant_support_request_status_with_audit(f.request_id,'new','in_progress',f.actor_id,old_version,'PRIVATE_REPLY_FIXTURE');
  if changed->>'public_response' <> 'PRIVATE_REPLY_FIXTURE' or changed->>'responded_at' is null then raise exception 'VERIFY_REPLY_MISSING'; end if;
  reply_version := (changed->>'updated_at')::timestamptz;
  if reply_version <= old_version then raise exception 'VERIFY_VERSION_NOT_ADVANCED'; end if;
  select count(*) into before_count from public.audit_events where entity_id=f.request_id;
  perform public.update_tenant_support_request_status_with_audit(f.request_id,'new','in_progress',f.actor_id,old_version,'PRIVATE_REPLY_FIXTURE');
  if (select count(*) from public.audit_events where entity_id=f.request_id) <> before_count then raise exception 'VERIFY_RETRY_DUPLICATED_AUDIT'; end if;
  begin
    perform public.update_tenant_support_request_status_with_audit(f.request_id,'in_progress','in_progress',f.actor_id,old_version,'STALE_REPLY_FIXTURE');
    raise exception 'VERIFY_STALE_REPLY_OVERWROTE';
  exception when raise_exception then if sqlerrm <> 'SUPPORT_REQUEST_STATUS_STALE' then raise; end if; end;
  changed := public.update_tenant_support_request_status_with_audit(f.request_id,'in_progress','in_progress',f.actor_id,reply_version,'UPDATED_PRIVATE_REPLY_FIXTURE');
  if changed->>'public_response' <> 'UPDATED_PRIVATE_REPLY_FIXTURE' then raise exception 'VERIFY_REPLY_ONLY_UPDATE_FAILED'; end if;
  if (changed->>'updated_at')::timestamptz <= reply_version then raise exception 'VERIFY_REPLY_ONLY_VERSION_UNCHANGED'; end if;
  if exists(select 1 from public.audit_events where entity_id=f.request_id
    and (coalesce(before_data::text,'')||coalesce(after_data::text,'')||coalesce(metadata::text,'')) like '%PRIVATE_%') then
    raise exception 'VERIFY_PRIVATE_TEXT_IN_AUDIT'; end if;
  if (select notes from public.tenants where id=f.tenant_id) <> 'UNCHANGED_PROFILE_FIXTURE' then raise exception 'VERIFY_PROFILE_CHANGED'; end if;
  changed := public.update_tenant_support_request_status_with_audit(f.request_id,'in_progress','resolved',f.actor_id);
  if changed->>'status' <> 'resolved' or changed->>'public_response' <> 'UPDATED_PRIVATE_REPLY_FIXTURE' then
    raise exception 'VERIFY_ROLLOUT_STATUS_RPC_CHANGED_REPLY'; end if;
end;
$$;
reset role;

create function pg_temp.reject_support_reply_audit() returns trigger language plpgsql as $$
begin raise exception 'VERIFY_INJECTED_AUDIT_FAILURE'; end;
$$;
create trigger qa_support_reply_audit_failure before insert on public.audit_events
for each row when (new.action='support_request.status_updated') execute function pg_temp.reject_support_reply_audit();
set local role service_role;
do $$
declare f record; original public.support_requests%rowtype;
begin
  select * into f from support_reply_fixture;
  select * into original from public.support_requests where id=f.request_id;
  begin
    perform public.update_tenant_support_request_status_with_audit(f.request_id,'resolved','in_progress',f.actor_id,original.updated_at,'FAILED_REPLY_FIXTURE');
    raise exception 'VERIFY_AUDIT_FAILURE_IGNORED';
  exception when raise_exception then if sqlerrm <> 'VERIFY_INJECTED_AUDIT_FAILURE' then raise; end if; end;
  if exists(select 1 from public.support_requests where id=f.request_id and
    (status <> original.status or public_response is distinct from original.public_response or updated_at <> original.updated_at)) then
    raise exception 'VERIFY_REPLY_AUDIT_NOT_ATOMIC'; end if;
end;
$$;
reset role;
set constraints all immediate;
rollback;
select true as tenant_support_public_response_verified;
