-- Fail-fast verification for the pending account migration.
-- All fixtures live inside this transaction and are rolled back.

begin;

do $$
declare
  token_column_count integer;
begin
  select count(*) into token_column_count
  from information_schema.columns
  where table_schema = 'public'
    and column_name = 'approval_claim_token'
    and table_name in ('access_requests', 'user_building_assignments', 'tenant_user_links');

  if token_column_count <> 3 then
    raise exception 'approval claim token fencing columns are incomplete';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.access_requests'::regclass and relrowsecurity
  ) then
    raise exception 'access_requests must have RLS enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'access_requests'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'anon/authenticated must have no access_requests privileges';
  end if;

  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'auth_user_create_pending_access_request'
      and event_object_schema = 'auth'
      and event_object_table = 'users'
  ) then
    raise exception 'pending request auth.users trigger is missing';
  end if;
end
$$;

create temporary table pending_account_test_context (
  pending_user_id uuid not null,
  provisioned_user_id uuid not null
) on commit drop;

insert into pending_account_test_context
values (gen_random_uuid(), gen_random_uuid());

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  pending_user_id,
  'authenticated',
  'authenticated',
  'pending-' || pending_user_id::text || '@verification.invalid',
  '',
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object('full_name', 'Pending Verification'),
  now(),
  now()
from pending_account_test_context
union all
select
  provisioned_user_id,
  'authenticated',
  'authenticated',
  'provisioned-' || provisioned_user_id::text || '@verification.invalid',
  '',
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'manager'),
  jsonb_build_object('full_name', 'Provisioned Verification'),
  now(),
  now()
from pending_account_test_context;

do $$
declare
  context pending_account_test_context%rowtype;
begin
  select * into context from pending_account_test_context;

  if not exists (
    select 1 from public.access_requests
    where auth_user_id = context.pending_user_id and status = 'pending'
  ) then
    raise exception 'missing-role auth user did not create a pending request';
  end if;

  if exists (
    select 1 from public.access_requests
    where auth_user_id = context.provisioned_user_id
  ) then
    raise exception 'provisioned auth user unexpectedly created a pending request';
  end if;

  begin
    insert into public.access_requests (auth_user_id, email)
    values (context.pending_user_id, 'duplicate@verification.invalid');
    raise exception 'duplicate auth user request was accepted';
  exception when unique_violation then
    null;
  end;

  begin
    update public.access_requests
    set status = 'invalid'
    where auth_user_id = context.pending_user_id;
    raise exception 'invalid request status was accepted';
  exception when check_violation then
    null;
  end;
end
$$;

set local role authenticated;

do $$
begin
  begin
    perform count(*) from public.access_requests;
    raise exception 'authenticated role could read access_requests directly';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

reset role;

do $$
declare
  context pending_account_test_context%rowtype;
  request_id uuid;
  first_result boolean;
  second_result boolean;
begin
  select * into context from pending_account_test_context;
  select id into request_id from public.access_requests where auth_user_id = context.pending_user_id;

  first_result := public.append_access_request_created_audit(request_id, context.pending_user_id);
  second_result := public.append_access_request_created_audit(request_id, context.pending_user_id);

  if first_result is not true or second_result is not false then
    raise exception 'creation audit function is not idempotent';
  end if;

  if (select count(*) from public.audit_events where action = 'user.access_request.created' and entity_id = context.pending_user_id) <> 1 then
    raise exception 'creation audit was not written exactly once';
  end if;
end
$$;

rollback;
